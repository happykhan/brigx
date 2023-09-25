import { writable } from 'svelte/store'

type Notification = string

export const notifications = writable<Notification[]>([])

export const addNotification = (notification: Notification) => {
    notifications.update((notifications) => [...notifications, notification])
    setTimeout(removeToast, 2000)
    }

function removeToast() {
    notifications.update((notifications) => notifications.slice(1))
}
