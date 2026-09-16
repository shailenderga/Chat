// Notification utility for Direct Device & Phone Push Notifications

let swRegistration = null;

// Initialize and register Service Worker for notifications
export async function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      swRegistration = reg;
      console.log('✅ Notification Service Worker registered:', reg.scope);

      // Listen for messages from SW (e.g. notification clicked)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NAVIGATE_CONVERSATION') {
          window.dispatchEvent(
            new CustomEvent('wavy_open_chat', {
              detail: { conversationId: event.data.conversationId }
            })
          );
        }
      });
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }
}

// Check current notification permission status
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// Request notification permission from user
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      sendDeviceNotification({
        title: '🔔 Notifications Enabled',
        body: 'You will now receive all message and call alerts directly on your device!',
        tag: 'wavy_welcome'
      });
    }
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

// Send Direct Device / Phone Notification
export function sendDeviceNotification({
  title,
  body,
  icon = '/icon.svg',
  tag = 'wavy_notification',
  data = {},
  onClick = null
}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  // Trigger Phone Vibration if available (e.g. Android phone)
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (e) {}
  }

  // Priority 1: Service Worker Notification (required for Android phones & background tabs)
  if (swRegistration && swRegistration.showNotification) {
    try {
      swRegistration.showNotification(title, {
        body,
        icon,
        badge: icon,
        tag,
        data,
        renotify: true,
        vibrate: [200, 100, 200]
      });
      return true;
    } catch (err) {
      console.warn('Service worker notification failed, trying fallback:', err);
    }
  }

  // Priority 2: Standard HTML5 Notification API fallback
  try {
    const notification = new Notification(title, {
      body,
      icon,
      tag,
      data
    });

    notification.onclick = function (event) {
      event.preventDefault();
      window.focus();

      if (onClick) {
        onClick();
      } else if (data.conversationId) {
        window.dispatchEvent(
          new CustomEvent('wavy_open_chat', {
            detail: { conversationId: data.conversationId }
          })
        );
      }

      notification.close();
    };

    return true;
  } catch (err) {
    console.warn('HTML5 Notification failed:', err);
    return false;
  }
}
