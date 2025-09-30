import { PrismaClient, LogType, Role } from '@prisma/client';
import { updateOccupancy } from '../utils/occupancy';

const prisma = new PrismaClient();

/**
 * Script to randomly add student users as active users (simulate QR code scans)
 * This creates ENTRY logs for random students, making them appear as if they scanned to enter
 */
async function addActiveUsers() {
  try {
    console.log('🎲 Starting to add random active users...\n');

    // Get all student users
    const allStudents = await prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      }
    });

    if (allStudents.length === 0) {
      console.log('❌ No student users found in the database.');
      console.log('💡 Tip: Run the populate script first to create test users.');
      return;
    }

    // Filter out students who are already inside (have active entries)
    const activeUsers = await prisma.entryExitLog.findMany({
      where: {
        type: LogType.ENTRY,
        user: { role: Role.STUDENT }
      },
      include: {
        user: true
      },
      orderBy: { timestamp: 'desc' }
    });

    // Get users who are currently inside (have ENTRY without subsequent EXIT)
    const currentlyInsideUserIds = new Set<string>();
    for (const entryLog of activeUsers) {
      const hasExitAfter = await prisma.entryExitLog.findFirst({
        where: {
          userId: entryLog.userId,
          type: LogType.EXIT,
          timestamp: { gt: entryLog.timestamp }
        }
      });
      
      if (!hasExitAfter) {
        currentlyInsideUserIds.add(entryLog.userId);
      }
    }

    // Filter out users who are already inside
    const availableStudents = allStudents.filter(
      student => !currentlyInsideUserIds.has(student.id)
    );

    if (availableStudents.length === 0) {
      console.log('ℹ️  All students are already inside the library.');
      return;
    }

    // Get current capacity status
    const config = await prisma.systemConfig.findFirst();
    if (!config) {
      console.log('❌ System configuration not found.');
      return;
    }

    const availableSlots = config.maxCapacity - config.currentOccupancy;
    if (availableSlots <= 0) {
      console.log('⚠️  Library is at full capacity. Cannot add more users.');
      console.log(`   Current occupancy: ${config.currentOccupancy}/${config.maxCapacity}`);
      return;
    }

    // Randomly select students (up to available slots or all available students)
    const countToAdd = Math.min(
      availableSlots,
      availableStudents.length,
      Math.floor(Math.random() * Math.min(availableSlots, availableStudents.length)) + 1 // Random between 1 and max available
    );

    const selectedStudents = availableStudents
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, countToAdd);

    console.log(`📊 Current status:`);
    console.log(`   - Total students: ${allStudents.length}`);
    console.log(`   - Already inside: ${currentlyInsideUserIds.size}`);
    console.log(`   - Available to add: ${availableStudents.length}`);
    console.log(`   - Current occupancy: ${config.currentOccupancy}/${config.maxCapacity}`);
    console.log(`   - Available slots: ${availableSlots}`);
    console.log(`\n🎯 Adding ${selectedStudents.length} random students as active users...\n`);

    const now = new Date();
    const entryLogs = [];

    // Create ENTRY logs for selected students
    for (const student of selectedStudents) {
      const expirationTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const entryLog = await prisma.entryExitLog.create({
        data: {
          userId: student.id,
          type: LogType.ENTRY,
          timestamp: now,
          expirationTime: expirationTime
        }
      });

      entryLogs.push(entryLog);

      // Update user statistics (frequencyUsed, lastActive)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentEntries = await prisma.entryExitLog.count({
        where: {
          userId: student.id,
          type: LogType.ENTRY,
          timestamp: { gte: thirtyDaysAgo }
        }
      });

      await prisma.user.update({
        where: { id: student.id },
        data: { frequencyUsed: recentEntries }
      });

      console.log(`   ✅ ${student.firstName} ${student.lastName} (${student.email})`);
      
      // Update occupancy for each entry
      await updateOccupancy(true); // Increment
    }

    const newConfig = await prisma.systemConfig.findFirst();
    console.log(`\n📊 Updated status:`);
    console.log(`   - New occupancy: ${newConfig?.currentOccupancy}/${newConfig?.maxCapacity}`);
    console.log(`   - Added ${entryLogs.length} active user(s)\n`);

    console.log('✅ Successfully added active users!');
    console.log('💡 Use the revert script to remove these active users.');

  } catch (error) {
    console.error('❌ Error adding active users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  addActiveUsers()
    .then(() => {
      console.log('\n🎉 Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { addActiveUsers };

