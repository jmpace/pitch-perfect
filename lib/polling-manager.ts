// Global singleton polling manager to prevent duplicate polling
class PollingManager {
  private static instance: PollingManager;
  private activePolls = new Map<string, {
    timeoutId: NodeJS.Timeout | null;
    isActive: boolean;
    lastRequest: number;
  }>();
  
  private constructor() {}
  
  static getInstance(): PollingManager {
    if (!PollingManager.instance) {
      PollingManager.instance = new PollingManager();
    }
    return PollingManager.instance;
  }
  
  isPolling(jobId: string): boolean {
    const poll = this.activePolls.get(jobId);
    return poll?.isActive === true;
  }
  
  startPolling(jobId: string): boolean {
    // Prevent polling if already active
    if (this.isPolling(jobId)) {
      console.log(`[PollingManager] Job ${jobId} already being polled - skipping duplicate`);
      return false;
    }
    
    // Start new poll
    this.activePolls.set(jobId, {
      timeoutId: null,
      isActive: true,
      lastRequest: Date.now()
    });
    
    console.log(`[PollingManager] Started polling for job ${jobId}`);
    return true;
  }
  
  setTimeoutId(jobId: string, timeoutId: NodeJS.Timeout): void {
    const poll = this.activePolls.get(jobId);
    if (poll) {
      poll.timeoutId = timeoutId;
    }
  }
  
  stopPolling(jobId: string): void {
    const poll = this.activePolls.get(jobId);
    if (poll) {
      if (poll.timeoutId) {
        clearTimeout(poll.timeoutId);
      }
      this.activePolls.delete(jobId);
      console.log(`[PollingManager] Stopped polling for job ${jobId}`);
    }
  }
  
  // Prevent rapid duplicate requests (debouncing)
  canMakeRequest(jobId: string): boolean {
    const poll = this.activePolls.get(jobId);
    if (!poll) {
      console.log(`[PollingManager] No active poll found for job ${jobId} - allowing request`);
      return true;
    }
    
    const timeSinceLastRequest = Date.now() - poll.lastRequest;
    const MIN_REQUEST_INTERVAL = 5000; // 5 seconds minimum between requests
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      console.log(`[PollingManager] Request throttled for job ${jobId} - only ${timeSinceLastRequest}ms since last request (min ${MIN_REQUEST_INTERVAL}ms)`);
      return false;
    }
    
    console.log(`[PollingManager] Request allowed for job ${jobId} - ${timeSinceLastRequest}ms since last request`);
    poll.lastRequest = Date.now();
    return true;
  }
  
  getAllActivePolls(): string[] {
    return Array.from(this.activePolls.keys()).filter(jobId => 
      this.activePolls.get(jobId)?.isActive
    );
  }
  
  stopAllPolling(): void {
    for (const jobId of this.activePolls.keys()) {
      this.stopPolling(jobId);
    }
    console.log(`[PollingManager] Stopped all polling`);
  }
}

export default PollingManager; 