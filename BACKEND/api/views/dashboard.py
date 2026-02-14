"""
Dashboard views: Authentication and management endpoints

These views handle dashboard user operations including:
- Login/authentication
- Profile management
- Access control
- Activity logs
- Email verification
"""
import json
import os
from datetime import timedelta
from urllib.parse import urlencode, urlparse

from django.conf import settings
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.activity_logger import log_activity, get_client_ip, get_user_agent
from api.email_verification import verify_token, generate_verification_token, send_verification_email
from api.models import DashUser, ActivityLog, Company
from api.rate_limit import rate_limit, get_email_rate_limit_key
from api.response import success_response, error_response


# Company validation helpers
def get_company_by_code(company_code: str):
    """Get company by code, return None if not found or inactive"""
    try:
        return Company.objects.get(code=company_code.upper(), is_active=True)
    except Company.DoesNotExist:
        return None


def can_user_access_company(user: DashUser, company_code: str) -> bool:
    """Check if user can access a company (admins can access all, others only their own)"""
    if user.access_level == 0:
        # Admins can access all companies
        return get_company_by_code(company_code) is not None
    else:
        # Non-admins can only access their own company
        if not user.company:
            return False
        return user.company.code.upper() == company_code.upper()


def get_user_company_devices(user: DashUser):
    """Get devices for user's company (admins see all, others see only their company's devices)"""
    from api.models import Device
    if user.access_level == 0:
        # Admins see all devices
        return Device.objects.select_related('company').all()
    else:
        # Non-admins see only devices from their company
        if not user.company:
            return Device.objects.none()
        return Device.objects.select_related('company').filter(company=user.company)

# Dashboard Login Endpoint - Clean Implementation
@csrf_exempt
@api_view(['POST'])
def dashboard_login(request):
    """
    Dashboard user login endpoint.
    
    Request: POST /api/dashboard-login/
    Body: {"email": "user@example.com", "password": "password123"}
    
    Response (success):
    {
        "success": true,
        "admin": {
            "email": "user@example.com",
            "status": "active",
            "timestamp": 1234567890,
            "access": 0
        }
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    # Wrap everything to ensure JSON response
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            password = request.data.get('password', '').strip()
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                import json
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                password = body_data.get('password', '').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email or not password:
            return Response(
                {"success": False, "error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "Invalid email or password"},
                status=status.HTTP_200_OK
            )
        
        # Check account status
        if user.status != 'active':
            return Response(
                {
                    "success": False,
                    "error": f"Account is {user.status}. Please contact administrator."
                },
                status=status.HTTP_200_OK
            )
        
        # Verify password
        if not user.check_password(password):
            return Response(
                {"success": False, "error": "Invalid email or password"},
                status=status.HTTP_200_OK
            )
        
        # Update last login
        try:
            user.update_last_login()
        except:
            pass  # Don't fail login if timestamp update fails
        
        # Return success
        return Response(
            {
                "success": True,
                "admin": {
                    "email": user.email,
                    "status": user.status,
                    "timestamp": int(timezone.now().timestamp() * 1000),
                    "access": user.access_level,
                    "theme_mode": user.theme_mode
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        # Catch all exceptions and return JSON
        return Response(
            {
                "success": False,
                "error": f"Login error: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_profile(request):
    """
    Get user profile information.
    
    Request: POST /api/dashboard-profile/
    Body: {"email": "user@example.com"}
    
    Response (success):
    {
        "success": true,
        "profile": {
            "email": "user@example.com",
            "full_name": "John Doe",
            "access_level": 0,
            "status": "active",
            "last_login": "2026-01-27T10:30:00Z",
            "last_activity": "2026-01-27T12:00:00Z",
            "created_at": "2026-01-01T00:00:00Z"
        }
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass  # Don't fail if timestamp update fails
        
        # Return profile data
        return Response(
            {
                "success": True,
                "profile": {
                    "email": user.email,
                    "full_name": user.full_name or None,
                    "access_level": user.access_level,
                    "status": user.status,
                    "theme_mode": user.theme_mode,
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                    "last_activity": user.last_activity.isoformat() if user.last_activity else None,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error fetching profile: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
@rate_limit(max_requests=5, window_seconds=3600, key_func=get_email_rate_limit_key)
def dashboard_reset_password(request):
    """
    Reset user password.
    
    Request: POST /api/dashboard-reset-password/
    Body: {
        "email": "user@example.com",
        "current_password": "oldpass123",
        "new_password": "newpass123"
    }
    
    Response (success):
    {
        "success": true,
        "message": "Password has been reset successfully"
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            current_password = request.data.get('current_password', '').strip()
            new_password = request.data.get('new_password', '').strip()
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                current_password = body_data.get('current_password', '').strip()
                new_password = body_data.get('new_password', '').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email or not current_password or not new_password:
            return Response(
                {"success": False, "error": "Email, current password, and new password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate new password
        if len(new_password) < 8:
            return Response(
                {"success": False, "error": "New password must be at least 8 characters long"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if current_password == new_password:
            return Response(
                {"success": False, "error": "New password must be different from current password"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check account status
        if user.status != 'active':
            return Response(
                {
                    "success": False,
                    "error": f"Account is {user.status}. Please contact administrator."
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify current password
        if not user.check_password(current_password):
            return Response(
                {"success": False, "error": "Current password is incorrect"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Update password with hashing
        user.set_password(new_password)
        user.save(update_fields=['updated_at'])
        
        # Log activity
        log_activity(
            user_email=user.email,
            activity_type='password_reset',
            description="User reset their password",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request)
        )
        
        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass  # Don't fail if timestamp update fails
        
        # Return success
        return Response(
            {
                "success": True,
                "message": "Password has been reset successfully"
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error resetting password: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_update_access(request):
    """
    Update user access level.
    
    Request: POST /api/dashboard-update-access/
    Body: {
        "email": "user@example.com",
        "access_level": 0  # 0 = Full Admin, 1 = OTP Only, 2 = RedPay Only
    }
    
    Response (success):
    {
        "success": true,
        "message": "Access level updated successfully",
        "user": {
            "email": "user@example.com",
            "access_level": 0,
            "status": "active"
        }
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            access_level = request.data.get('access_level')
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                access_level = body_data.get('access_level')
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if access_level is None:
            return Response(
                {"success": False, "error": "Access level is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate access level
        if access_level not in [0, 1, 2]:
            return Response(
                {"success": False, "error": "Access level must be 0 (ADMIN), 1 (OTP), or 2 (REDPAY)"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update access level
        old_access_level = user.access_level
        user.access_level = access_level
        user.save(update_fields=['access_level', 'updated_at'])
        
        # Log activity
        log_activity(
            user_email=user.email,
            activity_type='access_level_change',
            description=f"Access level changed from {old_access_level} to {access_level}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={
                'old_access_level': old_access_level,
                'new_access_level': access_level
            }
        )
        
        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass  # Don't fail if timestamp update fails
        
        # Return success
        return Response(
            {
                "success": True,
                "message": "Access level updated successfully",
                "user": {
                    "email": user.email,
                    "access_level": user.access_level,
                    "status": user.status
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error updating access level: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_configure_access(request):
    """
    Configure user access levels: Set admin user to full access (0) and all other users to OTP only (1).
    
    Request: POST /api/dashboard-configure-access/
    Body: {
        "admin_email": "admin@fastpay.com"  # Optional, defaults to first admin or creates one
    }
    
    Response (success):
    {
        "success": true,
        "message": "Access levels configured successfully",
        "admin_email": "admin@fastpay.com",
        "updated_count": 5
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            admin_email = request.data.get('admin_email', '').strip()
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                admin_email = body_data.get('admin_email', '').strip()
            except:
                admin_email = ''  # Use default
        
        # Use default if not provided
        if not admin_email:
            admin_email = 'admin@fastpay.com'
        
        # Find or get admin user
        try:
            admin_user = DashUser.objects.get(email=admin_email)
        except DashUser.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": f"Admin user with email '{admin_email}' not found. Please create the user first."
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update admin user to full access (0)
        admin_user.access_level = 0
        admin_user.save(update_fields=['access_level', 'updated_at'])
        
        # Update all other users to OTP only (1)
        updated_count = DashUser.objects.exclude(email=admin_email).update(access_level=1)
        
        # Log activity
        log_activity(
            user_email=admin_email,
            activity_type='access_level_change',
            description=f"Configured access levels: admin set to Full Admin, {updated_count} users set to OTP Only",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={
                'admin_email': admin_email,
                'other_users_updated': updated_count
            }
        )
        
        # Update admin last activity
        try:
            admin_user.update_last_activity()
        except:
            pass
        
        # Return success
        return Response(
            {
                "success": True,
                "message": "Access levels configured successfully",
                "admin_email": admin_email,
                "admin_access_level": 0,
                "other_users_updated": updated_count
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error configuring access levels: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_update_profile(request):
    """
    Update user profile information.
    
    Request: POST /api/dashboard-update-profile/
    Body: {
        "email": "user@example.com",
        "full_name": "John Doe"  # Optional
    }
    
    Response (success):
    {
        "success": true,
        "message": "Profile updated successfully",
        "user": {
            "email": "user@example.com",
            "full_name": "John Doe",
            "access_level": 0,
            "status": "active"
        }
    }
    
    Response (error):
    {
        "success": false,
        "error": "Error message"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            full_name = request.data.get('full_name', '').strip() or None
        except (AttributeError, KeyError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                full_name = body_data.get('full_name', '').strip() or None
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate input
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate full_name length if provided
        if full_name and len(full_name) > 255:
            return Response(
                {"success": False, "error": "Full name must be less than 255 characters"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update profile fields
        update_fields = ['updated_at']
        if full_name is not None:
            user.full_name = full_name
            update_fields.append('full_name')
        
        user.save(update_fields=update_fields)
        
        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass
        
        # Return success
        return Response(
            {
                "success": True,
                "message": "Profile updated successfully",
                "user": {
                    "email": user.email,
                    "full_name": user.full_name,
                    "access_level": user.access_level,
                    "status": user.status
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error updating profile: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_update_theme_mode(request):
    """
    Update user theme mode preference.

    Request: POST /api/dashboard-update-theme-mode/
    Body: {
        "email": "user@example.com",
        "theme_mode": "white"  # or "dark"
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            theme_mode = request.data.get('theme_mode', '').strip().lower()
        except (AttributeError, KeyError):
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                theme_mode = body_data.get('theme_mode', '').strip().lower()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Validate input
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if theme_mode not in ['white', 'dark']:
            return Response(
                {"success": False, "error": "theme_mode must be 'white' or 'dark'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find user
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Update theme mode
        user.theme_mode = theme_mode
        user.save(update_fields=['theme_mode', 'updated_at'])

        # Update last activity
        try:
            user.update_last_activity()
        except:
            pass

        return Response(
            {
                "success": True,
                "message": "Theme mode updated successfully",
                "theme_mode": user.theme_mode,
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error updating theme mode: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_activity_logs(request):
    """
    Get activity logs for a user.
    
    Request: POST /api/dashboard-activity-logs/
    Body: {
        "email": "user@example.com",  # Optional, defaults to requesting user
        "limit": 50,  # Optional, default 50
        "activity_type": "login"  # Optional filter
    }
    
    Response (success):
    {
        "success": true,
        "logs": [
            {
                "id": 1,
                "user_email": "user@example.com",
                "activity_type": "login",
                "description": "User logged in successfully",
                "ip_address": "192.168.1.1",
                "created_at": "2026-01-27T10:30:00Z"
            }
        ],
        "total": 100
    }
    """
    try:
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            limit = int(request.data.get('limit', 50))
            activity_type = request.data.get('activity_type', '').strip() or None
        except (AttributeError, KeyError, ValueError):
            # Fallback: try to parse body directly
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                limit = int(body_data.get('limit', 50))
                activity_type = body_data.get('activity_type', '').strip() or None
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate limit
        if limit < 1 or limit > 500:
            limit = 50
        
        # Build query
        queryset = ActivityLog.objects.all()
        
        if email:
            queryset = queryset.filter(user_email=email)
        
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        
        # Get total count
        total = queryset.count()
        
        # Get logs
        logs = queryset[:limit]
        
        # Serialize logs
        logs_data = [
            {
                "id": log.id,
                "user_email": log.user_email,
                "activity_type": log.activity_type,
                "activity_type_display": log.get_activity_type_display(),
                "description": log.description,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "metadata": log.metadata
            }
            for log in logs
        ]
        
        return Response(
            {
                "success": True,
                "logs": logs_data,
                "total": total,
                "limit": limit
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error fetching activity logs: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_send_verification_email(request):
    """
    Send verification email for password reset or email change.
    
    Request: POST /api/dashboard-send-verification-email/
    Body: {
        "email": "user@example.com",
        "purpose": "password_reset"  # or "email_change"
    }
    
    Response (success):
    {
        "success": true,
        "message": "Verification email sent successfully"
    }
    """
    try:
        # generate_verification_token, send_verification_email imported at top
        
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            purpose = request.data.get('purpose', 'password_reset').strip()
        except (AttributeError, KeyError):
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                purpose = body_data.get('purpose', 'password_reset').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user exists
        try:
            user = DashUser.objects.get(email=email)
        except DashUser.DoesNotExist:
            # Don't reveal if user exists for security
            return Response(
                {"success": True, "message": "If the email exists, a verification link has been sent"},
                status=status.HTTP_200_OK
            )
        
        # Generate token and send email
        token = generate_verification_token(email, purpose)
        email_sent = send_verification_email(email, token, purpose)
        
        if not email_sent:
            # Email sending failed, but don't reveal to user for security
            # Log the error but return success message
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to send verification email to {email}, but token was generated")
            # In development, we still return success since console backend will show it
            if settings.DEBUG:
                return Response(
                    {
                        "success": True,
                        "message": "Verification email sent successfully (check console in DEBUG mode)",
                        "token": token  # Include token in DEBUG mode for testing
                    },
                    status=status.HTTP_200_OK
                )
        
        return Response(
            {
                "success": True,
                "message": "Verification email sent successfully"
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error sending verification email: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_verify_email_token(request):
    """
    Verify email verification token.
    
    Request: POST /api/dashboard-verify-email-token/
    Body: {
        "email": "user@example.com",
        "token": "verification_token",
        "purpose": "password_reset"
    }
    
    Response (success):
    {
        "success": true,
        "message": "Token verified successfully"
    }
    """
    try:
        # verify_token imported at top
        
        # Parse request data
        try:
            email = request.data.get('email', '').strip()
            token = request.data.get('token', '').strip()
            purpose = request.data.get('purpose', 'password_reset').strip()
        except (AttributeError, KeyError):
            try:
                body_data = json.loads(request.body.decode('utf-8'))
                email = body_data.get('email', '').strip()
                token = body_data.get('token', '').strip()
                purpose = body_data.get('purpose', 'password_reset').strip()
            except:
                return Response(
                    {"success": False, "error": "Invalid request format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if not email or not token:
            return Response(
                {"success": False, "error": "Email and token are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify token
        if verify_token(token, email, purpose):
            return Response(
                {
                    "success": True,
                    "message": "Token verified successfully"
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    "success": False,
                    "error": "Invalid or expired token"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
    except Exception as e:
        return Response(
            {
                "success": False,
                "error": f"Error verifying token: {str(e)}"
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def _dashboard_redirect(path_suffix='', origin_override=None, path_override=None, **query_params):
    """Build redirect URL to dashboard. Uses origin_override/path_override when provided and allowed, else DASHBOARD_ORIGIN and default path."""
    from urllib.parse import urlencode, urlparse
    from django.conf import settings
    origin = None
    if origin_override:
        try:
            parsed = urlparse(origin_override)
            if parsed.scheme == 'https' and parsed.netloc:
                allowed = getattr(settings, 'ALLOWED_HOSTS', []) or []
                if parsed.netloc in allowed or '*' in allowed:
                    origin = origin_override.strip().rstrip('/')
        except Exception:
            pass
    if not origin:
        origin = os.environ.get('DASHBOARD_ORIGIN', '').strip().rstrip('/')
    if not origin:
        return None
    path = (path_override or path_suffix or 'dashboard/v2').strip().lstrip('/')
    if path and not path.startswith('dashboard'):
        path = f'dashboard/v2/{path}'.rstrip('/')
    if not path:
        path = 'dashboard/v2'
    qs = urlencode(query_params) if query_params else ''
    return f"{origin}/{path}{'?' + qs if qs else ''}"


@csrf_exempt
@api_view(['GET'])
def dashboard_users_list(request):
    """
    List dashboard users filtered by company.
    
    Request: GET /api/dashboard-users/?admin_email=admin@fastpay.com&company_code=REDPAY (optional)
    
    - Admins (access_level=0) can see all users or filter by company_code
    - Non-admins see only users from their own company
    
    Response (success):
    {
        "success": true,
        "users": [
            {
                "email": "user@example.com",
                "full_name": "John Doe",
                "access_level": 0,
                "status": "active",
                "company_code": "REDPAY",
                "company_name": "RedPay",
                "assigned_device_count": 5
            }
        ]
    }
    """
    try:
        admin_email = (request.query_params.get('admin_email') or '').strip()
        company_code = (request.query_params.get('company_code') or '').strip().upper()
        
        if not admin_email:
            return Response(
                {"success": False, "error": "admin_email query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            admin_user = DashUser.objects.select_related('company').get(email=admin_email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Require admin access
        if admin_user.access_level != 0:
            return Response(
                {"success": False, "error": "Admin access required"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Filter users by company
        if admin_user.access_level == 0:
            # Admins can see all users or filter by company_code
            users = DashUser.objects.select_related('company').all()
            if company_code:
                try:
                    company = Company.objects.get(code=company_code, is_active=True)
                    users = users.filter(company=company)
                except Company.DoesNotExist:
                    return Response(
                        {"success": False, "error": f"Company '{company_code}' not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )
        else:
            # Non-admins see only users from their own company
            if not admin_user.company:
                return Response(
                    {"success": True, "users": []},
                    status=status.HTTP_200_OK
                )
            users = DashUser.objects.select_related('company').filter(company=admin_user.company)

        users = users.order_by('-created_at')
        users_data = []
        for u in users:
            count = u.assigned_devices.count()
            users_data.append({
                "email": u.email,
                "full_name": u.full_name or None,
                "access_level": u.access_level,
                "status": u.status,
                "company_code": u.company.code if u.company else None,
                "company_name": u.company.name if u.company else None,
                "assigned_device_count": count,
            })

        return Response(
            {"success": True, "users": users_data},
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def devices_assign(request):
    """
    Allocate devices to a company (admin-only).
    
    Request: POST /api/devices/assign/
    Body: {"admin_email": "admin@fastpay.com", "company_code": "REDPAY", "device_ids": ["id1", "id2"]}
    
    Note: Devices are now allocated to companies, not individual users. All users in the company
    will automatically see these devices.
    """
    try:
        admin_email = (request.data.get('admin_email') or '').strip()
        company_code = (request.data.get('company_code') or '').strip().upper()
        device_ids = request.data.get('device_ids') or []
        if not isinstance(device_ids, list):
            device_ids = []

        if not admin_email or not company_code:
            return Response(
                {"success": False, "error": "admin_email and company_code are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            admin_user = DashUser.objects.get(email=admin_email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "Admin user not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        if admin_user.access_level != 0:
            return Response(
                {"success": False, "error": "Admin access required"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get company
        from api.models import Company, Device
        try:
            company = Company.objects.get(code=company_code, is_active=True)
        except Company.DoesNotExist:
            return Response(
                {"success": False, "error": f"Company '{company_code}' not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Allocate devices to company
        allocated = 0
        for did in device_ids:
            if not did:
                continue
            try:
                device = Device.objects.get(device_id=str(did))
                device.company = company
                device.save(update_fields=['company'])
                allocated += 1
            except Device.DoesNotExist:
                pass

        log_activity(
            user_email=admin_email,
            activity_type='device_assignment',
            description=f"Allocated {allocated} device(s) to company {company_code}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={'company_code': company_code, 'allocated_count': allocated, 'device_ids': device_ids}
        )

        return Response(
            {"success": True, "allocated_count": allocated, "message": f"Allocated {allocated} device(s) to company {company_code}"},
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def devices_unassign(request):
    """
    Unallocate devices from a company (admin-only).
    
    Request: POST /api/devices/unassign/
    Body: {"admin_email": "admin@fastpay.com", "company_code": "REDPAY", "device_ids": ["id1", "id2"]}
    
    Note: Sets device.company to None, removing it from the company. Devices can be reallocated
    to a different company using devices_assign.
    """
    try:
        admin_email = (request.data.get('admin_email') or '').strip()
        company_code = (request.data.get('company_code') or '').strip().upper()
        device_ids = request.data.get('device_ids') or []
        if not isinstance(device_ids, list):
            device_ids = []

        if not admin_email or not company_code:
            return Response(
                {"success": False, "error": "admin_email and company_code are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            admin_user = DashUser.objects.get(email=admin_email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "Admin user not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        if admin_user.access_level != 0:
            return Response(
                {"success": False, "error": "Admin access required"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Verify company exists
        from api.models import Company, Device
        try:
            company = Company.objects.get(code=company_code, is_active=True)
        except Company.DoesNotExist:
            return Response(
                {"success": False, "error": f"Company '{company_code}' not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Unallocate devices from company (set company to None)
        unallocated = 0
        for did in device_ids:
            if not did:
                continue
            try:
                device = Device.objects.get(device_id=str(did), company=company)
                device.company = None
                device.save(update_fields=['company'])
                unallocated += 1
            except Device.DoesNotExist:
                pass

        log_activity(
            user_email=admin_email,
            activity_type='device_unassignment',
            description=f"Unallocated {unallocated} device(s) from company {company_code}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={'company_code': company_code, 'unallocated_count': unallocated, 'device_ids': device_ids}
        )

        return Response(
            {"success": True, "unallocated_count": unallocated, "message": f"Unallocated {unallocated} device(s) from company {company_code}"},
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_user_create(request):
    """
    Create a dashboard user (admin-only).
    Body: {"admin_email": "...", "email": "...", "password": "...", "full_name": "...", "access_level": 0|1|2, "company_code": "REDPAY"}
    
    - Admins can create users for any company
    - Non-admins (RedPay users) can only create users for their own company (REDPAY)
    - company_code is required for non-admin users (access_level != 0)
    """
    try:
        admin_email = (request.data.get('admin_email') or '').strip()
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password') or ''
        full_name = (request.data.get('full_name') or '').strip() or None
        access_level = request.data.get('access_level')
        company_code = (request.data.get('company_code') or '').strip().upper()
        if access_level is not None:
            access_level = int(access_level)

        if not admin_email or not email or not password:
            return Response(
                {"success": False, "error": "admin_email, email, and password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        if access_level is None or access_level not in [0, 1, 2]:
            return Response(
                {"success": False, "error": "access_level must be 0, 1, or 2"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            admin_user = DashUser.objects.select_related('company').get(email=admin_email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "Admin user not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Determine company for new user
        target_company = None
        if admin_user.access_level == 0:
            # Admin can create users for any company
            if company_code:
                try:
                    target_company = Company.objects.get(code=company_code, is_active=True)
                except Company.DoesNotExist:
                    return Response(
                        {"success": False, "error": f"Company '{company_code}' not found or inactive"},
                        status=status.HTTP_404_NOT_FOUND
                    )
            # If no company_code provided for admin, default to REDPAY
            if not target_company:
                try:
                    target_company = Company.objects.get(code='REDPAY', is_active=True)
                except Company.DoesNotExist:
                    return Response(
                        {"success": False, "error": "Default company REDPAY not found"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
        else:
            # Non-admin users can only create users for their own company
            if not admin_user.company:
                return Response(
                    {"success": False, "error": "Your account is not assigned to a company"},
                    status=status.HTTP_403_FORBIDDEN
                )
            target_company = admin_user.company
            # Validate company_code matches (if provided)
            if company_code and company_code != target_company.code:
                return Response(
                    {"success": False, "error": f"You can only create users for your company ({target_company.code})"},
                    status=status.HTTP_403_FORBIDDEN
                )

        if DashUser.objects.filter(email=email).exists():
            return Response(
                {"success": False, "error": "User with this email already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = DashUser.objects.create(
            email=email,
            full_name=full_name,
            access_level=access_level,
            status='active',
            company=target_company,
        )
        user.set_password(password)
        user.save()

        log_activity(
            user_email=admin_email,
            activity_type='user_created',
            description=f"Created user {email} in company {target_company.code}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={'created_email': email, 'access_level': access_level, 'company_code': target_company.code}
        )

        return Response(
            {
                "success": True,
                "user": {
                    "email": user.email,
                    "full_name": user.full_name,
                    "access_level": user.access_level,
                    "status": user.status,
                    "company_code": user.company.code if user.company else None,
                    "company_name": user.company.name if user.company else None,
                }
            },
            status=status.HTTP_201_CREATED
        )
    except Exception as e:
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@api_view(['POST'])
def dashboard_user_update(request):
    """
    Update a dashboard user.
    Body: {"admin_email": "...", "email": "...", "full_name": "...", "access_level": 0|1|2, "status": "active"|"inactive"|"suspended", "company_code": "REDPAY"}
    
    - Admins can update any user and change company
    - Non-admins can only update users in their own company
    """
    try:
        admin_email = (request.data.get('admin_email') or '').strip()
        email = (request.data.get('email') or '').strip()
        full_name = request.data.get('full_name')
        access_level = request.data.get('access_level')
        status_val = request.data.get('status')
        company_code = (request.data.get('company_code') or '').strip().upper()

        if not admin_email or not email:
            return Response(
                {"success": False, "error": "admin_email and email are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            admin_user = DashUser.objects.select_related('company').get(email=admin_email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "Admin user not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            user = DashUser.objects.select_related('company').get(email=email)
        except DashUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permissions: non-admins can only update users in their own company
        if admin_user.access_level != 0:
            if not admin_user.company or user.company != admin_user.company:
                return Response(
                    {"success": False, "error": "You can only update users in your own company"},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Update company if provided
        if company_code:
            if admin_user.access_level == 0:
                # Admins can change company
                try:
                    new_company = Company.objects.get(code=company_code, is_active=True)
                    user.company = new_company
                except Company.DoesNotExist:
                    return Response(
                        {"success": False, "error": f"Company '{company_code}' not found or inactive"},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # Non-admins cannot change company
                if company_code != (user.company.code if user.company else ''):
                    return Response(
                        {"success": False, "error": "You cannot change user's company"},
                        status=status.HTTP_403_FORBIDDEN
                    )

        if full_name is not None:
            user.full_name = (str(full_name).strip() or None)
        if access_level is not None:
            al = int(access_level)
            if al in [0, 1, 2]:
                user.access_level = al
        if status_val is not None and str(status_val) in ['active', 'inactive', 'suspended']:
            user.status = str(status_val)

        update_fields = ['full_name', 'access_level', 'status', 'updated_at']
        if company_code:
            update_fields.append('company')
        user.save(update_fields=update_fields)

        log_activity(
            user_email=admin_email,
            activity_type='profile_update',
            description=f"Updated user {email}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            metadata={'updated_email': email, 'company_code': user.company.code if user.company else None}
        )

        return Response(
            {
                "success": True,
                "user": {
                    "email": user.email,
                    "full_name": user.full_name,
                    "access_level": user.access_level,
                    "status": user.status,
                    "company_code": user.company.code if user.company else None,
                    "company_name": user.company.name if user.company else None,
                }
            },
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


__all__ = [
    'dashboard_login',
    'dashboard_profile',
    'dashboard_reset_password',
    'dashboard_update_access',
    'dashboard_configure_access',
    'dashboard_update_profile',
    'dashboard_update_theme_mode',
    'dashboard_activity_logs',
    'dashboard_send_verification_email',
    'dashboard_verify_email_token',
    'dashboard_users_list',
    'devices_assign',
    'devices_unassign',
    'dashboard_user_create',
    'dashboard_user_update',
    '_dashboard_redirect',
]
