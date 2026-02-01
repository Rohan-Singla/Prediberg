import 'dotenv/config';
import { OracleService } from './resolution/oracle-service.js';

async function main() {
  console.log('Starting Prediberg Oracle Service...');

  const oracle = new OracleService();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down oracle service...');
    await oracle.stop();
    process.exit(0);
  });

  await oracle.start();
}

main().catch((err) => {
  console.error('Oracle service error:', err);
  process.exit(1);
});
