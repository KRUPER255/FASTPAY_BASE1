"""
Sheet worker: registry of processes (upload zip, sheet link → Excel, etc.)
and API to list processes and run one with file or sheet link input.
"""

from .registry import PROCESS_REGISTRY, get_process

__all__ = ['PROCESS_REGISTRY', 'get_process']
