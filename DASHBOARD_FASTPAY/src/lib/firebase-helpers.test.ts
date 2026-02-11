/**
 * Tests for Firebase helper functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getDevicePath,
  getDeviceMessagesPath,
  getDeviceNotificationsPath,
  getDeviceContactsPath,
  getDeviceSystemInfoPath,
  getDeviceCommandsPath,
  getDeviceCommandHistoryPath,
  getDeviceListPath,
  getDeviceListStatusCardTextPath,
  getDeviceListBankcodePath,
  getHeartbeatsPath,
} from './firebase-helpers'

// Mock Firebase
vi.mock('./firebase', () => ({
  database: {},
}))

vi.mock('firebase/database', () => ({
  ref: vi.fn((db: any, path: string) => ({
    _path: path,
    toString: () => path,
  })),
}))

describe('firebase-helpers', () => {
  const mockDeviceId = 'test_device_12345'
  const mockCode = 'TESTCODE123'

  describe('getDevicePath', () => {
    it('should return device path without subpath', () => {
      const result = getDevicePath(mockDeviceId)
      expect(result._path).toBe(`device/${mockDeviceId}`)
    })

    it('should return device path with subpath', () => {
      const result = getDevicePath(mockDeviceId, 'permission')
      expect(result._path).toBe(`device/${mockDeviceId}/permission`)
    })
  })

  describe('getDeviceMessagesPath', () => {
    it('should return messages path', () => {
      const result = getDeviceMessagesPath(mockDeviceId)
      expect(result._path).toBe(`message/${mockDeviceId}`)
    })
  })

  describe('getDeviceNotificationsPath', () => {
    it('should return notifications path', () => {
      const result = getDeviceNotificationsPath(mockDeviceId)
      expect(result._path).toBe(`notification/${mockDeviceId}`)
    })
  })

  describe('getDeviceContactsPath', () => {
    it('should return contacts path', () => {
      const result = getDeviceContactsPath(mockDeviceId)
      expect(result._path).toBe(`contact/${mockDeviceId}`)
    })
  })

  describe('getDeviceSystemInfoPath', () => {
    it('should return system info path without subtask', () => {
      const result = getDeviceSystemInfoPath(mockDeviceId)
      expect(result._path).toBe(`device/${mockDeviceId}/systemInfo`)
    })

    it('should return system info path with subtask', () => {
      const result = getDeviceSystemInfoPath(mockDeviceId, 'buildInfo')
      expect(result._path).toBe(`device/${mockDeviceId}/systemInfo/buildInfo`)
    })
  })

  describe('getDeviceCommandsPath', () => {
    it('should return commands path without command', () => {
      const result = getDeviceCommandsPath(mockDeviceId)
      expect(result._path).toBe(`fastpay/${mockDeviceId}/commands`)
    })

    it('should return commands path with command', () => {
      const result = getDeviceCommandsPath(mockDeviceId, 'sendSms')
      expect(result._path).toBe(`fastpay/${mockDeviceId}/commands/sendSms`)
    })
  })

  describe('getDeviceCommandHistoryPath', () => {
    it('should return command history path without timestamp', () => {
      const result = getDeviceCommandHistoryPath(mockDeviceId)
      expect(result._path).toBe(`fastpay/${mockDeviceId}/commandHistory`)
    })

    it('should return command history path with timestamp', () => {
      const timestamp = 1234567890
      const result = getDeviceCommandHistoryPath(mockDeviceId, timestamp)
      expect(result._path).toBe(`fastpay/${mockDeviceId}/commandHistory/${timestamp}`)
    })
  })

  describe('getDeviceListPath', () => {
    it('should return testing mode path', () => {
      const result = getDeviceListPath(mockCode, undefined, 'testing')
      expect(result._path).toBe(`fastpay/testing/${mockCode}`)
    })

    it('should return running mode path', () => {
      const result = getDeviceListPath(mockCode, undefined, 'running')
      expect(result._path).toBe(`fastpay/running/${mockCode}`)
    })
  })

  describe('getDeviceListStatusCardTextPath', () => {
    it('should return status card text path for testing mode', () => {
      const result = getDeviceListStatusCardTextPath(mockCode, 'testing')
      expect(result._path).toBe(`fastpay/testing/${mockCode}/status_card_text`)
    })

    it('should return status card text path for running mode', () => {
      const result = getDeviceListStatusCardTextPath(mockCode, 'running')
      expect(result._path).toBe(`fastpay/running/${mockCode}/status_card_text`)
    })
  })

  describe('getDeviceListBankcodePath', () => {
    it('should return bankcode path for testing mode', () => {
      const result = getDeviceListBankcodePath(mockCode, mockCode, 'testing')
      expect(result._path).toBe(`fastpay/testing/${mockCode}/bankcode-${mockCode}`)
    })

    it('should return bankcode path for running mode', () => {
      const result = getDeviceListBankcodePath(mockCode, mockCode, 'running')
      expect(result._path).toBe(`fastpay/running/${mockCode}/bankcode-${mockCode}`)
    })
  })

  describe('getHeartbeatsPath', () => {
    it('should return heartbeat path', () => {
      const result = getHeartbeatsPath(mockDeviceId)
      expect(result._path).toBe(`hertbit/${mockDeviceId}`)
    })
  })
})
