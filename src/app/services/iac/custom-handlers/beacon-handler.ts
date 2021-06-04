import { IACHandlerStatus, IACMessageHandler } from '@airgap/angular-core'
import { P2PPairingRequest, Serializer } from '@airgap/beacon-sdk'

import { BeaconService } from '../../beacon/beacon.service'

const isBeaconMessage: (obj: unknown) => obj is P2PPairingRequest = (obj: unknown): obj is P2PPairingRequest => {
  return (
    typeof (obj as P2PPairingRequest).name === 'string' &&
    typeof (obj as P2PPairingRequest).publicKey === 'string' &&
    typeof (obj as P2PPairingRequest).relayServer === 'string'
    // version is not checked to be v1 compatible
  )
}

const isValidUrl: (url: string) => Promise<boolean> = async (url: string): Promise<boolean> => {
  try {
    // tslint:disable-next-line: no-unused-expression
    new URL(url)
  } catch {
    return false
  }

  return true
}

/**
 * Handles beacon requests
 *
 * This request is a stringified json with the properties "publicKey", "relayServer" and "name"
 */
export class BeaconHandler extends IACMessageHandler {
  public readonly name: string = 'BeaconHandler'

  constructor(private readonly beaconService: BeaconService) {
    super()
  }
  private async canHandle(json: unknown): Promise<boolean> {
    if (isBeaconMessage(json)) {
      await this.beaconService.client.isConnected
      await this.beaconService.addPeer(json)

      return true
    } else {
      return false
    }
  }

  public async receive(data: string | string[]): Promise<IACHandlerStatus> {
    const stringData: string = typeof data === 'string' ? data : data[0]

    // Check if it's a beacon request
    try {
      const json: Record<string, unknown> = JSON.parse(stringData)

      const canHandle = await this.canHandle(json)
      return canHandle ? IACHandlerStatus.SUCCESS : IACHandlerStatus.UNSUPPORTED
    } catch (e) {
      try {
        const payload: string = stringData
        if (await isValidUrl(payload)) {
          const params: URLSearchParams = new URL(payload).searchParams
          if (params && params.get('type') === 'tzip10') {
            const json: Record<string, unknown> = (await new Serializer().deserialize(params.get('data'))) as any

            const canHandle = await this.canHandle(json)
            return canHandle ? IACHandlerStatus.SUCCESS : IACHandlerStatus.UNSUPPORTED
          }
        } else {
          const json: Record<string, unknown> = (await new Serializer().deserialize(stringData)) as any

          const canHandle = await this.canHandle(json)
          return canHandle ? IACHandlerStatus.SUCCESS : IACHandlerStatus.UNSUPPORTED
        }
      } catch (err) {
        //
      }
      //
    }

    return IACHandlerStatus.UNSUPPORTED
  }

  public async getProgress(): Promise<number> {
    return 100
  }

  public async getResult(): Promise<undefined> {
    return undefined
  }

  public async reset(): Promise<void> {
    return
  }

  public async handleComplete(): Promise<boolean> {
    return true
  }
}
