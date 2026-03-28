import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export interface Judge {
  name: string;
  title: string;
  photo: string;
  linkedIn: string;
}

export interface Founder {
  name: string;
  company: string;
  photo: string;
  linkedIn: string;
  pitchTitle: string;
  investment?: {
    received: boolean;
    amount?: number;
    date?: string;
    notes?: string;
  };
}

export interface EventMedia {
  photos: string[];
  videos: {
    title: string;
    url: string;
    thumbnail: string;
  }[];
  photoAlbumUrl: string;
}

export interface AurrinEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  eventbriteUrl: string;
  description: string;
  coverImage: string;
  status: "upcoming" | "past";
  judges: Judge[];
  founders: Founder[];
  media: EventMedia;
  notes: string;
}
