package com.sukundev.sukunchan

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class MediaNotificationListener : NotificationListenerService() {
    
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        // Required for MediaSessionManager
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // Required for MediaSessionManager
    }
}