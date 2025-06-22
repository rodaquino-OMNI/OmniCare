


export class HL7v2RouterService {
  async routeMessage(message: string): Promise<{ routed: boolean; destination: string }> {
    return { routed: true, destination: 'default-destination' };
  }
}
