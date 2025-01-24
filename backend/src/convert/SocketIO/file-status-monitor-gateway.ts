import { Logger } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { PrismaService } from 'prisma/prisma.service';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class FileStatusMonitorGateway {  
  constructor(private readonly prisma: PrismaService) {}
  private files = {};
  
  private logger = new Logger('External Connection');   
  
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('file-to-conversion-queue')
  handleFileMonitoring(client: any): any {
    this.server.emit('file-to-conversion-queue',this.files);
    return {"files": this.files};
  }

  @SubscribeMessage('upload-file-to-conversion')
  handleFileUploadToConversion(client: any, payload: {fileToConvert: string}): any {
    this.files[payload.fileToConvert]  =  'awaiting';
    this.server.emit('file-to-conversion-queue',this.files);
  }

  @SubscribeMessage('notify-event')
  handleNotifyEvent(client: any,payload: {event: string, data:any}) {    
    this.server.emit(payload.event, payload.data);
    console.log(`Success! ${payload.event}:${payload.data}`);
    return `Success! ${payload.event}:${payload.data}`;
  }

  @SubscribeMessage('update-file-status')
  async handleUpdateFilestatus(client: any, payload: {fileToConvert: string, status: string}): Promise<any> {
    this.files[payload.fileToConvert] = payload.status;
    this.server.emit('file-to-conversion-queue',this.files);
   
    await this.prisma.file.update({      
        where:{
          fileName: payload.fileToConvert
        },
        data:{
          status: payload.status
        }
      }
    );
  }

  handleConnection(socket: Socket) {
    this.server.emit('file-to-conversion-queue',this.files);
    this.logger.log(`Socket connected: ${socket.id}`);    
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Socket disconnected: ${socket.id}`);    
  }

}
