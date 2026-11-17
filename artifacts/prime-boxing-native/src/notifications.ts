import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const ENABLED_KEY = 'prime.membership-notifications.enabled';
const REMINDER_MARKER = 'primeMembershipReminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getMembershipNotificationsEnabled() {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

export async function setMembershipNotificationsEnabled(enabled: boolean) {
  await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
  if (!enabled) await cancelMembershipNotifications();
}

export async function requestMembershipNotificationPermission() {
  await Notifications.setNotificationChannelAsync('membership-reminders', {
    name: 'تذكيرات الاشتراكات',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 150, 100, 150],
  });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function cancelMembershipNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.[REMINDER_MARKER] === true)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

function jordanLocalMorning(dateOnly: string, leadDays: number) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!year || !month || !day) return null;
  // Devices are expected to use Jordan's local time. Keep the alert generic so
  // member names, phone numbers, and financial details never appear on lock screens.
  return new Date(year, month - 1, day - leadDays, 9, 0, 0, 0);
}

export async function syncMembershipNotifications(
  alerts: Array<{ subscriptionId: number; endDate: string }>,
) {
  if (!(await getMembershipNotificationsEnabled())) return;
  await cancelMembershipNotifications();
  const now = new Date();
  const unique = new Set<string>();

  for (const alert of alerts) {
    for (const leadDays of [2, 0]) {
      const scheduleAt = jordanLocalMorning(alert.endDate, leadDays);
      const key = `${alert.subscriptionId}:${leadDays}:${alert.endDate}`;
      if (!scheduleAt || scheduleAt <= now || unique.has(key)) continue;
      unique.add(key);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Prime Boxing Academy',
          body: leadDays === 0
            ? 'ينتهي اليوم اشتراك أحد المشتركين. افتح التطبيق لمراجعة قائمة الاشتراكات.'
            : 'يقترب موعد انتهاء اشتراك أحد المشتركين. افتح التطبيق لمراجعة القائمة.',
          data: { [REMINDER_MARKER]: true, subscriptionId: alert.subscriptionId, leadDays },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: scheduleAt,
          channelId: 'membership-reminders',
        },
      });
    }
  }
}
