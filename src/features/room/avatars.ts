// Avatars a room guest can pick: Icons8 "color" animals, stored in
// public/avatars/room/ (locked in icons8.json) so students' computers never
// call a third-party site. The server only stores the slug.

export const ROOM_AVATARS = [
  "fox", "panda", "red-panda", "lion", "rabbit", "turtle", "elephant", "giraffe",
  "penguin", "unicorn", "bear", "butterfly", "owl", "parrot", "bee", "octopus",
  "whale", "wolf", "cat", "dog", "hedgehog", "squirrel", "flamingo", "frog",
] as const;

export type RoomAvatar = (typeof ROOM_AVATARS)[number];

export const avatarUrl = (slug: string) =>
  (ROOM_AVATARS as readonly string[]).includes(slug) ? `/avatars/room/${slug}.png` : "/avatars/student.webp";

/** A random avatar, so a student who does not care can just press enter. */
export const randomAvatar = (): RoomAvatar => ROOM_AVATARS[Math.floor(Math.random() * ROOM_AVATARS.length)];
