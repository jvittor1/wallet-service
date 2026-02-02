import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  create(@Body() createWalletDto: CreateWalletDto) {
    return this.walletService.create(createWalletDto);
  }

  @Get()
  findAll() {
    return this.walletService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.walletService.findById(id);
  }

  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.walletService.findByUserId(userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.walletService.remove(id);
  }
}
