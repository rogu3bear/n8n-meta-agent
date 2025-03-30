import { BackupManager } from '../../services/backupManager';
import { TestUtils } from '../utils/testUtils';

describe('BackupManager', () => {
  let manager: BackupManager;

  beforeEach(() => {
    manager = new BackupManager();
  });

  describe('Backup Creation', () => {
    it('should create a full backup', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      expect(backup).toBeDefined();
      expect(backup.type).toBe('full');
      expect(backup.description).toBe('Test backup');
      expect(backup.timestamp).toBeDefined();
      expect(backup.size).toBeDefined();
    });

    it('should create an incremental backup', async () => {
      const backup = await manager.createBackup({
        type: 'incremental',
        description: 'Test incremental backup',
        baseBackupId: 'test-base-backup'
      });

      expect(backup).toBeDefined();
      expect(backup.type).toBe('incremental');
      expect(backup.baseBackupId).toBe('test-base-backup');
    });

    it('should create a scheduled backup', async () => {
      const schedule = {
        type: 'full',
        frequency: 'daily',
        time: '00:00'
      };

      await manager.scheduleBackup(schedule);
      const scheduled = await manager.getScheduledBackups();

      expect(scheduled).toContainEqual(schedule);
    });
  });

  describe('Backup Storage', () => {
    it('should store backup data', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      const stored = await manager.getBackup(backup.id);
      expect(stored).toEqual(backup);
    });

    it('should handle backup compression', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      const compressed = await manager.compressBackup(backup.id);
      const decompressed = await manager.decompressBackup(compressed.id);

      expect(compressed.size).toBeLessThan(backup.size);
      expect(decompressed).toEqual(backup);
    });

    it('should manage backup retention', async () => {
      const oldBackup = await manager.createBackup({
        type: 'full',
        description: 'Old backup',
        timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days ago
      });

      await manager.cleanupOldBackups(7); // Keep last 7 days
      const stored = await manager.getBackup(oldBackup.id);
      expect(stored).toBeNull();
    });
  });

  describe('Backup Restoration', () => {
    it('should restore a full backup', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      const result = await manager.restoreBackup(backup.id);
      expect(result.success).toBe(true);
      expect(result.restoredData).toBeDefined();
    });

    it('should restore an incremental backup', async () => {
      const baseBackup = await manager.createBackup({
        type: 'full',
        description: 'Base backup'
      });

      const incrementalBackup = await manager.createBackup({
        type: 'incremental',
        description: 'Incremental backup',
        baseBackupId: baseBackup.id
      });

      const result = await manager.restoreBackup(incrementalBackup.id);
      expect(result.success).toBe(true);
      expect(result.restoredData).toBeDefined();
    });

    it('should validate backup integrity', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      const isValid = await manager.validateBackup(backup.id);
      expect(isValid).toBe(true);
    });
  });

  describe('Backup Management', () => {
    it('should list all backups', async () => {
      await manager.createBackup({
        type: 'full',
        description: 'Backup 1'
      });

      await manager.createBackup({
        type: 'incremental',
        description: 'Backup 2'
      });

      const backups = await manager.listBackups();
      expect(backups.length).toBeGreaterThanOrEqual(2);
    });

    it('should get backup details', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      const details = await manager.getBackupDetails(backup.id);
      expect(details).toBeDefined();
      expect(details.id).toBe(backup.id);
      expect(details.type).toBe(backup.type);
      expect(details.size).toBeDefined();
      expect(details.timestamp).toBeDefined();
    });

    it('should delete a backup', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      await manager.deleteBackup(backup.id);
      const stored = await manager.getBackup(backup.id);
      expect(stored).toBeNull();
    });
  });

  describe('Backup Export/Import', () => {
    it('should export backup data', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      const exported = await manager.exportBackup(backup.id);
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('should import backup data', async () => {
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Test backup'
      });

      const exported = await manager.exportBackup(backup.id);
      const imported = await manager.importBackup(exported);

      expect(imported).toBeDefined();
      expect(imported.type).toBe(backup.type);
      expect(imported.description).toBe(backup.description);
    });

    it('should handle export/import errors', async () => {
      await expect(manager.exportBackup('invalid-id')).rejects.toThrow();
      await expect(manager.importBackup('invalid-data')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle backup creation errors', async () => {
      await expect(manager.createBackup({
        type: 'invalid',
        description: 'Test backup'
      })).rejects.toThrow();
    });

    it('should handle restoration errors', async () => {
      await expect(manager.restoreBackup('invalid-id')).rejects.toThrow();
    });

    it('should handle storage errors', async () => {
      const invalidBackup = {
        id: 'test',
        type: null,
        description: null,
        timestamp: null
      };

      await expect(manager.storeBackup(invalidBackup)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large backups', async () => {
      const startTime = Date.now();
      const backup = await manager.createBackup({
        type: 'full',
        description: 'Large backup',
        data: Array(1000000).fill('test data').join('')
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(backup.size).toBeGreaterThan(0);
    });

    it('should maintain performance with many backups', async () => {
      const startTime = Date.now();
      const numBackups = 100;

      for (let i = 0; i < numBackups; i++) {
        await manager.createBackup({
          type: 'full',
          description: `Backup ${i}`
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle concurrent backup operations', async () => {
      const startTime = Date.now();
      const numOperations = 10;

      const operations = Array(numOperations).fill(null).map((_, i) => 
        manager.createBackup({
          type: 'full',
          description: `Concurrent backup ${i}`
        })
      );

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(results.length).toBe(numOperations);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
}); 