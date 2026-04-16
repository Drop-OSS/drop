export function fetchPostAuthors(): {
  [key: string]: {
    name: string
    avatar: string
  }
} {
  return {
    decduck: {
      name: 'DecDuck',
      avatar: '/avatars/decduck.jpg',
    },
  }
}
