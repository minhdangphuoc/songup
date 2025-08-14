import { getSession } from "@/lib/session"
import { createClient } from "@/lib/supabase/client"
import { notFound } from "next/navigation"
import { RoomPage } from "./room"

export async function generateMetadata(props: {
    params: Promise<{ code: string }>
}) {
    const params = await props.params
    return {
        title: "Room - " + params.code,
    }
}

export default async function Page(props: {
    params: Promise<{ code: string }>
}) {
    const params = await props.params
    const session = await getSession()

    const supabase = createClient()

    const { data: room, error } = await supabase
        .from("rooms")
        .select()
        .eq("code", params.code)
        .single()

    if (error || !room) {
        notFound()
    }
    
    return (
        <RoomPage
            room={room}
            user={{
                isLoggedIn: session.isLoggedIn,
                username: session.username,
                uuid: session.uuid,
            }}
        />
    )
}
