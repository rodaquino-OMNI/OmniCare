


export class HL7v2InterfaceService {
  async sendMessage(message: string, destination: string): Promise<boolean> {
    return true;
  }
  
  async receiveMessage(): Promise<string | null> {
    return null;
  }
}
