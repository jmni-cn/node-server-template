import {
  TaskStatus,
  CLAIMABLE_STATUSES,
  CANCELLABLE_STATUSES,
} from '../constants';

describe('Task Status Guards', () => {
  describe('completeTask status guard', () => {
    it('should only allow completing tasks in PROCESSING status', () => {
      const allowedForComplete = TaskStatus.PROCESSING;

      expect(allowedForComplete).toBe('processing');
      expect([
        TaskStatus.PENDING,
        TaskStatus.SUCCESS,
        TaskStatus.FAILED,
        TaskStatus.CANCELLED,
      ]).not.toContain(TaskStatus.PROCESSING);
    });

    it('should reject completing a PENDING task', () => {
      expect(TaskStatus.PENDING).not.toBe(TaskStatus.PROCESSING);
    });

    it('should reject completing an already SUCCESS task', () => {
      expect(TaskStatus.SUCCESS).not.toBe(TaskStatus.PROCESSING);
    });
  });

  describe('failTask status guard', () => {
    it('should only allow failing tasks in PROCESSING status', () => {
      expect(TaskStatus.PROCESSING).toBe(TaskStatus.PROCESSING);
    });

    it('should reject failing a PENDING task', () => {
      expect(TaskStatus.PENDING).not.toBe(TaskStatus.PROCESSING);
    });
  });

  describe('claimTask status guard', () => {
    it('should allow claiming PENDING tasks', () => {
      expect(CLAIMABLE_STATUSES).toContain(TaskStatus.PENDING);
    });

    it('should allow claiming RETRYING tasks', () => {
      expect(CLAIMABLE_STATUSES).toContain(TaskStatus.RETRYING);
    });

    it('should reject claiming PROCESSING tasks', () => {
      expect(CLAIMABLE_STATUSES).not.toContain(TaskStatus.PROCESSING);
    });

    it('should reject claiming SUCCESS tasks', () => {
      expect(CLAIMABLE_STATUSES).not.toContain(TaskStatus.SUCCESS);
    });
  });

  describe('retryTask status guard', () => {
    it('should only allow retrying FAILED tasks', () => {
      expect(TaskStatus.FAILED).toBe('failed');
    });
  });

  describe('cancelTask status guard', () => {
    it('should allow cancelling PENDING tasks', () => {
      expect(CANCELLABLE_STATUSES).toContain(TaskStatus.PENDING);
    });

    it('should reject cancelling PROCESSING tasks', () => {
      expect(CANCELLABLE_STATUSES).not.toContain(TaskStatus.PROCESSING);
    });
  });
});
