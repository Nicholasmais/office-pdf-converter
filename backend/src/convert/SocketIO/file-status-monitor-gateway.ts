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
    return this.files;
  }

  @SubscribeMessage('upload-file-to-conversion')
  handleFileUploadToConversion(client: any, payload: {fileToConvert: string}): any {
    this.files[payload.fileToConvert]  =  'awaiting';
  }

  @SubscribeMessage('notify-event')
  handleNotifyEvent(client: any,payload: {event: string, data:any}) {    
    this.files[payload.data]  =  'awaiting';
    this.server.emit(payload.event, this.files);
    return `Success! ${payload.event}:${payload.data}`;
  }

  @SubscribeMessage('update-file-status')
  async handleUpdateFilestatus(client: any, payload: {fileToConvert: string, status: string}): Promise<any> {
    this.files[payload.fileToConvert] = payload.status;
 
    this.server.emit("file-to-conversion-queue", this.files);
    if (payload.status === "done"){
      delete this.files[payload.fileToConvert];
    };
    const file = await this.prisma.file.update({      
        where:{
          fileName: payload.fileToConvert
        },
        data:{
          status: payload.status
        }
      }
    );

    await this.prisma.convertedFile.create({
        data:{
          fileName: payload.fileToConvert.slice(0, payload.fileToConvert.lastIndexOf(".")) + ".pdf",
          fileId: file.id,
        }
      }
    );
  }

  handleConnection(socket: Socket) {
    this.logger.log(`Socket connected: ${socket.id}`);    
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Socket disconnected: ${socket.id}`);    
  }

}
