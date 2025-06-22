


export class NCPDPScriptService {
  async sendPrescription(prescription: any): Promise<{ success: boolean; transactionId: string }> {
    return { success: true, transactionId: 'stub-tx-id' };
  }
  
  async getRefillStatus(prescriptionId: string): Promise<any> {
    return { status: 'pending' };
  }
}
