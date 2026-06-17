export const groupNotificationsByDate = (notifications) => {
  const groups = { today: [], yesterday: [], lastWeek: [], older: [] };
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  notifications.forEach(notif => {
    const date = new Date(notif.createdAt).getTime();
    const diff = todayStart - date;

    if (diff <= 0) groups.today.push(notif);
    else if (diff <= oneDay) groups.yesterday.push(notif);
    else if (diff <= 7 * oneDay) groups.lastWeek.push(notif);
    else groups.older.push(notif);
  });

  return groups;
};