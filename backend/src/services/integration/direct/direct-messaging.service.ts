


export class DirectMessagingService {
  async sendDirectMessage(message: any): Promise<{ messageId: string; sent: boolean }> {
    return { messageId: 'stub-message-id', sent: true };
  }
  
  async receiveDirectMessages(): Promise<any[]> {
    return [];
  }
}
