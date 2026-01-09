import Foundation

/**
 * RaceSyncModule - Native clock synchronization for multi-phone timing
 *
 * Responsibilities:
 * - Provide monotonic uptime in nanoseconds
 * - Collect sync samples (NTP-style)
 * - Filter RTT and compute median offset
 * - Calculate sync uncertainty (MAD)
 * - Grade sync quality
 */
@objc(RaceSyncModule)
class RaceSyncModule: NSObject {

  // MARK: - Sync Sample Storage

  private struct SyncSample {
    let t1: UInt64  // Initiator send time
    let t2: UInt64  // Responder receive time
    let t3: UInt64  // Responder send time
    let t4: UInt64  // Initiator receive time
    let rtt: UInt64 // Round-trip time
    let offset: Int64 // Clock offset (signed)
  }

  private var samples: [SyncSample] = []
  private let maxSamples = 100
  private let minSamplesForSync = 10

  // Current sync state
  private var currentOffsetNanos: Int64 = 0
  private var currentUncertaintyMs: Double = 999.0
  private var isReady: Bool = false

  // MARK: - Time Access

  /**
   * Get current monotonic uptime in nanoseconds as string
   * Uses DispatchTime which is monotonic and not affected by clock adjustments
   */
  @objc
  func getUptimeNanos() -> String {
    let nanos = DispatchTime.now().uptimeNanoseconds
    return String(nanos)
  }

  /**
   * Get current uptime as UInt64 (internal use)
   */
  private func uptimeNanosInternal() -> UInt64 {
    return DispatchTime.now().uptimeNanoseconds
  }

  // MARK: - Sync Protocol

  /**
   * Handle incoming sync ping - capture t2 immediately and return timestamps for pong
   * Called by JS when a syncPing is received
   *
   * @param t1 - Original ping send time from initiator (string nanos)
   * @return Dictionary with t2, t3 as string nanos
   */
  @objc
  func handleSyncPing(_ t1: String) -> [String: String] {
    let t2 = uptimeNanosInternal()
    // t3 captured just before return (minimal processing between t2 and t3)
    let t3 = uptimeNanosInternal()
    return [
      "t2": String(t2),
      "t3": String(t3)
    ]
  }

  /**
   * Add a sync sample after receiving pong
   * Called by JS with all 4 timestamps
   *
   * @param t1 - Initiator send time
   * @param t2 - Responder receive time
   * @param t3 - Responder send time
   * @param t4 - Initiator receive time
   */
  @objc
  func addSyncSample(_ t1: String, t2: String, t3: String, t4: String) {
    guard let t1Val = UInt64(t1),
          let t2Val = UInt64(t2),
          let t3Val = UInt64(t3),
          let t4Val = UInt64(t4) else {
      print("[RaceSync] Invalid timestamp strings")
      return
    }

    // NTP-style calculation
    // RTT = (t4 - t1) - (t3 - t2)
    let totalTime = t4Val - t1Val
    let remoteProcessingTime = t3Val - t2Val
    let rtt = totalTime - remoteProcessingTime

    // Offset = ((t2 - t1) + (t3 - t4)) / 2
    // This is the offset to add to local time to get remote time
    let offset1 = Int64(t2Val) - Int64(t1Val)
    let offset2 = Int64(t3Val) - Int64(t4Val)
    let offset = (offset1 + offset2) / 2

    let sample = SyncSample(
      t1: t1Val,
      t2: t2Val,
      t3: t3Val,
      t4: t4Val,
      rtt: rtt,
      offset: offset
    )

    samples.append(sample)

    // Keep only recent samples
    if samples.count > maxSamples {
      samples.removeFirst(samples.count - maxSamples)
    }

    // Recalculate sync state
    recalculateSync()
  }

  /**
   * Clear all sync samples and reset state
   */
  @objc
  func resetSync() {
    samples.removeAll()
    currentOffsetNanos = 0
    currentUncertaintyMs = 999.0
    isReady = false
  }

  /**
   * Get current sync status
   * @return Dictionary with offsetNanos, uncertaintyMs, sampleCount, quality, isReady
   */
  @objc
  func getSyncStatus() -> [String: Any] {
    return [
      "offsetNanos": String(currentOffsetNanos),
      "uncertaintyMs": currentUncertaintyMs,
      "sampleCount": samples.count,
      "quality": qualityGrade(),
      "isReady": isReady
    ]
  }

  // MARK: - Time Conversion

  /**
   * Convert remote uptime nanos to local uptime nanos
   *
   * @param remoteNanos - Time in remote device's uptime domain (string)
   * @param offsetNanos - Offset from local to remote (string, can be negative)
   * @return Local uptime nanos as string
   */
  @objc
  func convertRemoteToLocal(_ remoteNanos: String, offsetNanos: String) -> String {
    guard let remote = UInt64(remoteNanos),
          let offset = Int64(offsetNanos) else {
      return "0"
    }
    // localTime = remoteTime - offset
    // (offset is what we add to local to get remote, so subtract to go back)
    let local = Int64(remote) - offset
    return String(local)
  }

  // MARK: - Internal Calculations

  /**
   * Recalculate offset and uncertainty from collected samples
   * Uses RTT filtering (best 30%) and median offset
   */
  private func recalculateSync() {
    guard samples.count >= minSamplesForSync else {
      isReady = false
      return
    }

    // Sort by RTT to filter best samples
    let sortedByRtt = samples.sorted { $0.rtt < $1.rtt }

    // Keep best 30% of samples
    let keepCount = max(minSamplesForSync, Int(Double(sortedByRtt.count) * 0.3))
    let bestSamples = Array(sortedByRtt.prefix(keepCount))

    // Extract offsets from best samples
    let offsets = bestSamples.map { $0.offset }

    // Calculate median offset
    let sortedOffsets = offsets.sorted()
    let medianOffset: Int64
    if sortedOffsets.count % 2 == 0 {
      let mid = sortedOffsets.count / 2
      medianOffset = (sortedOffsets[mid - 1] + sortedOffsets[mid]) / 2
    } else {
      medianOffset = sortedOffsets[sortedOffsets.count / 2]
    }

    // Calculate MAD (Median Absolute Deviation) for uncertainty
    let absoluteDeviations = offsets.map { abs($0 - medianOffset) }
    let sortedDeviations = absoluteDeviations.sorted()
    let madNanos: Int64
    if sortedDeviations.count % 2 == 0 {
      let mid = sortedDeviations.count / 2
      madNanos = (sortedDeviations[mid - 1] + sortedDeviations[mid]) / 2
    } else {
      madNanos = sortedDeviations[sortedDeviations.count / 2]
    }

    // Also factor in median RTT/2 as additional uncertainty
    let rtts = bestSamples.map { $0.rtt }
    let sortedRtts = rtts.sorted()
    let medianRtt: UInt64
    if sortedRtts.count % 2 == 0 {
      let mid = sortedRtts.count / 2
      medianRtt = (sortedRtts[mid - 1] + sortedRtts[mid]) / 2
    } else {
      medianRtt = sortedRtts[sortedRtts.count / 2]
    }

    // Total uncertainty = MAD + RTT/2 (in ms)
    let uncertaintyNanos = Double(madNanos) + Double(medianRtt) / 2.0
    let uncertaintyMs = uncertaintyNanos / 1_000_000.0

    currentOffsetNanos = medianOffset
    currentUncertaintyMs = uncertaintyMs
    isReady = true
  }

  /**
   * Grade sync quality based on uncertainty
   */
  private func qualityGrade() -> String {
    if currentUncertaintyMs <= 3.0 {
      return "excellent"
    } else if currentUncertaintyMs <= 5.0 {
      return "good"
    } else if currentUncertaintyMs <= 10.0 {
      return "ok"
    } else {
      return "poor"
    }
  }

  // MARK: - React Native Bridge

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
