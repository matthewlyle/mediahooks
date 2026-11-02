import type { PlexPayload } from "./types.ts";

export const SAMPLE_PAYLOAD: PlexPayload = {
  event: "media.play",
  user: true,
  owner: true,
  Account: { id: 1, title: "plexuser" },
  Server: { title: "My Server", uuid: "sample-server" },
  Player: {
    local: true,
    publicAddress: "203.0.113.10",
    title: "Plex Web (Chrome)",
    uuid: "sample-player",
  },
  Metadata: {
    type: "episode",
    title: "Pilot",
    summary: "A stranger arrives in town the night the lights go out.",
    grandparentTitle: "Sample Show",
    parentTitle: "Season 1",
    parentIndex: 1,
    index: 1,
    year: 2024,
    librarySectionID: 2,
    librarySectionTitle: "TV Shows",
    librarySectionType: "show",
    ratingKey: "1000",
  },
};

export const SAMPLE_MOVIE_PAYLOAD: PlexPayload = {
  ...SAMPLE_PAYLOAD,
  Metadata: {
    type: "movie",
    title: "Sample Movie",
    summary: "A projectionist finds a reel that wasn't there yesterday.",
    year: 2023,
    librarySectionID: 1,
    librarySectionTitle: "Movies",
    librarySectionType: "movie",
    ratingKey: "2000",
  },
};

export const SAMPLE_TRACK_PAYLOAD: PlexPayload = {
  ...SAMPLE_PAYLOAD,
  Metadata: {
    type: "track",
    title: "Night Drive",
    grandparentTitle: "Sample Artist",
    parentTitle: "Sample Album",
    parentIndex: 1,
    index: 4,
    year: 2022,
    librarySectionID: 3,
    librarySectionTitle: "Music",
    librarySectionType: "artist",
    ratingKey: "3000",
  },
};
