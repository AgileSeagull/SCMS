import { PrismaClient, LogType, Role } from '@prisma/client';
import { updateOccupancy } from '../utils/occupancy';

const prisma = new PrismaClient();

/**
 * Script to remove all active users (create EXIT logs for all users currently inside)
 * This reverts the changes made by addActiveUsers.ts
 */
async function removeActiveUsers() {
  try {
    console.log('🧹 Starting to remove active users...\n');

    // Get all student users
    const allStudents = await prisma.user.findMany({
      where: { role: Role.STUDENT },
      include: {
        entryExitLogs: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (allStudents.length === 0) {
      console.log('ℹ️  No student users found.');
      return;
    }

    // Find all users who are currently inside
    // Get all recent entries and check if they have exits
    const recentEntries = await prisma.entryExitLog.findMany({
      where: {
        type: LogType.ENTRY,
        user: { role: Role.STUDENT }
      },
      include: {
        user: true
      },
      orderBy: { timestamp: 'desc' }
    });

    const activeUsers: Array<{
      user: any;
      entryLog: any;
    }> = [];

    // Check each entry to see if user is still inside
    for (const entryLog of recentEntries) {
      // Check if there's an exit after this entry
      const exitAfterEntry = await prisma.entryExitLog.findFirst({
        where: {
          userId: entryLog.userId,
          type: LogType.EXIT,
          timestamp: { gt: entryLog.timestamp }
        }
      });

      // If no exit, user is currently inside
      // Also check if we've already added this user (avoid duplicates)
      if (!exitAfterEntry && !activeUsers.find(au => au.user.id === entryLog.user.id)) {
        activeUsers.push({
          user: entryLog.user,
          entryLog: entryLog
        });
      }
    }

    if (activeUsers.length === 0) {
      console.log('ℹ️  No active users found. All users have already exited.');
      return;
    }

    console.log(`📊 Current status:`);
    console.log(`   - Active users (inside): ${activeUsers.length}\n`);

    console.log(`🚪 Creating EXIT logs for ${activeUsers.length} active user(s)...\n`);

    const now = new Date();
    let exitCount = 0;

    // Create EXIT logs for all active users
    for (const activeUser of activeUsers) {
      const exitLog = await prisma.entryExitLog.create({
        data: {
          userId: activeUser.user.id,
          type: LogType.EXIT,
          timestamp: now,
          expirationTime: null
        }
      });

      // Update user's lastActive
      await prisma.user.update({
        where: { id: activeUser.user.id },
        data: { lastActive: now }
      });

      exitCount++;
      console.log(`   ✅ ${activeUser.user.firstName} ${activeUser.user.lastName} (${activeUser.user.email})`);
    }

    // Update occupancy (decrement for each exit)
    for (let i = 0; i < exitCount; i++) {
      await updateOccupancy(false); // Decrement
    }

    const newConfig = await prisma.systemConfig.findFirst();
    console.log(`\n📊 Updated status:`);
    console.log(`   - New occupancy: ${newConfig?.currentOccupancy}/${newConfig?.maxCapacity}`);
    console.log(`   - Removed ${exitCount} active user(s)\n`);

    console.log('✅ Successfully removed all active users!');
    console.log('💡 The database is now back to its original state.');

  } catch (error) {
    console.error('❌ Error removing active users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  removeActiveUsers()
    .then(() => {
      console.log('\n🎉 Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { removeActiveUsers };

