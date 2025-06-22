


export class DirectSecurityService {
  async encryptMessage(message: any): Promise<string> {
    return 'encrypted-stub-message';
  }
  
  async decryptMessage(encryptedMessage: string): Promise<any> {
    return { decrypted: true };
  }
}
