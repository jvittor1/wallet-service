import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { DepositWithdrawDto, TransferDto } from './dto/create-transaction.dto';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  findAll() {
    return this.transactionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionService.findById(id);
  }

  @Post('deposit-withdraw')
  depositWithdraw(@Body() depositWithdrawDto: DepositWithdrawDto) {
    return this.transactionService.depositWithdraw(depositWithdrawDto);
  }

  @Post('transfer')
  transfer(@Body() transferDto: TransferDto) {
    return this.transactionService.transfer(transferDto);
  }
}
