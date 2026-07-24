import { type DownloadableMetadata, DownloadableType } from '~/types'

export default function generateGameMeta(gameId: string, version: string): DownloadableMetadata {
    return {
        id: gameId,
        version,
        downloadType: DownloadableType.Game
    }
}
