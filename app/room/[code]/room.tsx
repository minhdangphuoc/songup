"use client"

import { SearchSongDialog } from "@/components/room/search-dialog"
import { UsernameForm } from "@/components/session/username-form"
import { SongCard } from "@/components/songs/song-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/hooks/use-toast"
import { Room, Song } from "@/types/global"
import { UUID } from "crypto"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { addSongToQueue, SongResult } from "./actions"
import { createClient } from "@/lib/supabase/client"
import {
    useQuery,
    useSubscription,
} from "@supabase-cache-helpers/postgrest-react-query"

export function RoomPage({
    room,
    user,
}: {
    room: Room
    user: {
        isLoggedIn: boolean
        username: string
        uuid: UUID
    }
}) {

    const [dialogOpen, setDialogOpen] = useState(false)
    const [songsAddedByUser, setSongsAddedByUser] = useState<Song[]>([])

    const supabase = createClient()

    // query the current song from the rooms table
    const { data } = useQuery(
        supabase
            .from("rooms")
            .select("current_song")
            .eq("code", room.code!)
            .single(),
    )

    const currentSong = data?.current_song ?? 0

    // subscribe to changes to the room to update the current song
    useSubscription(
        supabase,
        "postgres_rooms_changes",
        {
            event: "*",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${room.id}`,
        },
        ["id"],
    )

    let { data: songs = [] } = useQuery(
        supabase
            .from("songs")
            .select("*")
            .eq("room", room.id)
            .gte("id", currentSong)
            .order("id"),
        {
            placeholderData: (prev) => prev,
        },
    )

    if (!songs) songs = []

    // subscribe to changes in the songs
    useSubscription(
        supabase,
        "postgres_songs_changes",
        {
            event: "*",
            schema: "public",
            table: "songs",
            filter: `room=eq.${room.id}`,
        },
        ["id"],
    )

    useEffect(() => {
        if (songs.length > 1) {
            setSongsAddedByUser(songs?.filter(
                (song) =>
                    song.added_by === user.uuid && song.id > (room?.current_song ?? 0),
            ))
        }
    }, [songs, room.current_song])

    const songsLeftToAdd =
        room?.max_songs_per_user &&
        room.max_songs_per_user - (songsAddedByUser?.length ?? 0)

    async function addSong(song: SongResult) {
        const response = await addSongToQueue(room.code!, song)
        if (response.ok) {
            toast({ title: "Song added to queue!" })
            // close dialog
            setDialogOpen(false)
            return true
        } else {
            toast({ title: "Error adding song", description: response.message })
            return false
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-500 to-indigo-950 p-4 text-white">
            <header className="mb-6 flex w-full items-center justify-between">
                <Link href="/">
                    <div className="flex items-center gap-2">
                        <ArrowLeft className="size-6" />
                        <h1 className="text-xl font-bold"> {!user.username ? "" : (user.username)}</h1>
                    </div>
                </Link>
                <h2 className="text-xl">
                    <span className="font-bold">{room.code}</span>
                </h2>
            </header>
            <main className="flex flex-col gap-4">
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold">Now Playing</h2>
                    {songs.length > 0 ? (
                        <SongCard song={songs[0]} active />
                    ) : (
                        <div className="rounded-lg border border-white/20 bg-white/10 p-3 shadow-md">
                            <p className="text-md text-gray-300">
                                No songs in queue. Add some!
                            </p>
                        </div>
                    )}
                </section>
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold">Up Next</h2>
                    {songs.length > 1 ? (
                        <ScrollArea className="max-h-96">
                            <ul className="flex flex-col gap-2">
                                {songs.slice(1).map((song) => (
                                    <li key={song.id}>
                                        <SongCard song={song} />
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    ) : (
                        <div className="rounded-lg border border-white/20 bg-white/10 p-3 shadow-md">
                            <p className="text-md text-gray-300">
                                No songs in queue. Add some!
                            </p>
                        </div>
                    )}
                </section>
                <section className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold">Add songs</h2>
                    <div className="rounded-lg border border-white/20 bg-white/10 p-3 shadow-md">
                        {!user.isLoggedIn || !user.username ? (
                            <UsernameForm />
                        ) : (
                            <div className="flex flex-col gap-2">
                                {songsLeftToAdd ? (
                                    <p>
                                        You can add up to{" "}
                                        <span className="font-bold">
                                            {songsLeftToAdd}
                                        </span>{" "}
                                        more songs.
                                    </p>
                                ) : (
                                    <p>
                                        You can&apos;t add any more songs at the
                                        moment.
                                    </p>
                                )}
                                <SearchSongDialog
                                    addSong={addSong}
                                    open={dialogOpen}
                                    setOpen={setDialogOpen}
                                    disableTrigger={songsLeftToAdd <= 0}
                                />
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    )
}
