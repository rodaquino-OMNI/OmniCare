


export class CoverageService {
  async getCoverage(patientId: string): Promise<any> {
    return { patientId, coverages: [] };
  }
  
  async updateCoverage(patientId: string, coverage: any): Promise<boolean> {
    return true;
  }
}
