import type { Component } from "vue"

export type NavigationItem = {
    prefix: string,
    route: string,
    label: string,
}

export type QuickActionNav = {
    icon: Component,
    notifications?: Ref<number>,
    action: () => Promise<void>,
}