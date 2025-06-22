


export class IntegrationUtilityService {
  async validateData(data: any, schema: any): Promise<boolean> {
    return true;
  }
  
  async transformData(data: any, mapping: any): Promise<any> {
    return data;
  }
}
