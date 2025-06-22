


export class ErrorHandlingService {
  async handleError(error: any, context: string): Promise<void> {
    console.error(`Integration error in ${context}:`, error);
  }
  
  async retryOperation(operation: () => Promise<any>, retries: number = 3): Promise<any> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        return this.retryOperation(operation, retries - 1);
      }
      throw error;
    }
  }
}
