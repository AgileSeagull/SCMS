import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// List of student emails created by the populate script
const POPULATED_STUDENT_EMAILS = [
  'rudra.saxena@university.edu',
  'rohan.sharma@university.edu',
  'priya.patel@university.edu',
  'arjun.gupta@university.edu',
  'sneha.reddy@university.edu',
  'vikram.kumar@university.edu',
  'ananya.singh@university.edu',
  'rahul.verma@university.edu',
  'meera.joshi@university.edu',
  'aditya.malhotra@university.edu',
  'kavya.nair@university.edu',
  'siddharth.sharma@university.edu',
  'divya.bansal@university.edu',
  'kabir.chopra@university.edu',
  'neha.kapoor@university.edu',
  'karan.agarwal@university.edu',
  'sanjana.mehta@university.edu',
  'harsh.rao@university.edu',
  'aanya.iyer@university.edu',
  'rishabh.tiwari@university.edu',
];

async function resetData() {
  try {
    console.log('🧹 Starting data reset and cleanup...');
    
    // Get current stats before reset
    const currentUsers = await prisma.user.count();
    const currentLogs = await prisma.entryExitLog.count();
    const currentConfig = await prisma.systemConfig.findFirst();
    const currentStatusHistory = await prisma.libraryStatus.count();
    
    console.log('\n📊 Current data:');
    console.log(`  - Total users: ${currentUsers}`);
    console.log(`  - Entry/Exit logs: ${currentLogs}`);
    console.log(`  - Library status history: ${currentStatusHistory}`);
    console.log(`  - Current occupancy: ${currentConfig?.currentOccupancy || 0}`);
    console.log(`  - Max capacity: ${currentConfig?.maxCapacity || 0}`);
    
    // Clear all entry/exit logs FIRST (users have foreign key constraints)
    console.log('\n📝 Clearing all entry/exit logs...');
    const deletedLogs = await prisma.entryExitLog.deleteMany({});
    console.log(`✅ Deleted ${deletedLogs.count} entry/exit logs`);
    
    // Clear library status history
    console.log('\n📚 Clearing library status history...');
    const deletedStatus = await prisma.libraryStatus.deleteMany({});
    console.log(`✅ Deleted ${deletedStatus.count} library status records`);
    
    // Delete populated student users (after logs are deleted to avoid foreign key constraints)
    console.log('\n👥 Deleting populated student users...');
    let deletedUserCount = 0;
    for (const email of POPULATED_STUDENT_EMAILS) {
      const result = await prisma.user.deleteMany({
        where: { email: email }
      });
      if (result.count > 0) {
        deletedUserCount += result.count;
      }
    }
    console.log(`✅ Deleted ${deletedUserCount} populated student users`);
    
    // Reset occupancy to 0 (preserve maxCapacity if it exists)
    console.log('\n👥 Resetting occupancy to 0...');
    
    // Update or create system config
    if (currentConfig) {
      await prisma.systemConfig.update({
        where: { id: currentConfig.id },
        data: { 
          currentOccupancy: 0,
          // Preserve existing maxCapacity, or use default of 100
          maxCapacity: currentConfig.maxCapacity || 100,
          updatedAt: new Date()
        }
      });
      console.log(`✅ Updated existing system config (occupancy: 0, maxCapacity: ${currentConfig.maxCapacity || 100})`);
    } else {
      await prisma.systemConfig.create({
        data: {
          maxCapacity: 100,
          currentOccupancy: 0
        }
      });
      console.log('✅ Created new system config');
    }
    
    // Create a default library status (OPEN)
    console.log('\n📖 Creating default library status...');
    await prisma.libraryStatus.create({
      data: {
        status: 'OPEN',
        message: 'Library is open',
        isAutoScheduled: false
      }
    });
    console.log('✅ Created default library status');
    
    // Verify the reset
    const updatedConfig = await prisma.systemConfig.findFirst();
    const remainingLogs = await prisma.entryExitLog.count();
    const remainingStatus = await prisma.libraryStatus.count();
    
    console.log('\n📊 Reset completed - Current data:');
    console.log(`  - Entry/Exit logs: ${remainingLogs}`);
    console.log(`  - Library status history: ${remainingStatus}`);
    console.log(`  - Current occupancy: ${updatedConfig?.currentOccupancy || 0}`);
    console.log(`  - Max capacity: ${updatedConfig?.maxCapacity || 0}`);
    
    console.log('\n✅ Data reset completed successfully!');
    console.log('💡 The database is now in a clean state (only users remain).');
    
  } catch (error) {
    console.error('❌ Error during data reset:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset if this script is executed directly
if (require.main === module) {
  resetData()
    .then(() => {
      console.log('🎉 Reset script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Reset script failed:', error);
      process.exit(1);
    });
}

export { resetData };
