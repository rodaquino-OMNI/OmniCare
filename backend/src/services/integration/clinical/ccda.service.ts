


export class CCDAService {
  async generateCCDA(encounter: any): Promise<string> {
    return '<?xml version="1.0"?><ClinicalDocument></ClinicalDocument>';
  }
  
  async importCCDA(ccdaDocument: string): Promise<any> {
    return { imported: true, resources: [] };
  }
}
