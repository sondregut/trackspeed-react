import Foundation

/**
 * RaceSessionModule - Native race session management for multi-phone timing
 *
 * Responsibilities:
 * - Track role (start/finish)
 * - Store clock offset from sync
 * - Convert PTS timestamps to uptime nanoseconds
 * - Record start/finish crossing times
 * - Compute split time
 */
@objc(RaceSessionModule)
class RaceSessionModule: NSObject {

  // MARK: - State

  private var role: String = ""
  private var sessionId: String = ""
  private var clockOffsetNanos: Int64 = 0

  // Start time in our local uptime domain (for finish phone, converted from start phone)
  private var tStartLocalNanos: UInt64 = 0

  // Finish time in our local uptime domain
  private var tFinishLocalNanos: UInt64 = 0

  // Flags
  private var hasStartTime: Bool = false
  private var hasFinishTime: Bool = false

  // MARK: - Configuration

  @objc
  func setRole(_ role: String) {
    self.role = role
  }

  @objc
  func getRole() -> String {
    return role
  }

  @objc
  func setSessionId(_ sessionId: String) {
    self.sessionId = sessionId
  }

  @objc
  func setClockOffset(_ offsetNanos: String) {
    if let offset = Int64(offsetNanos) {
      self.clockOffsetNanos = offset
    }
  }

  // MARK: - PTS to Uptime Conversion

  /**
   * Convert a PTS crossing timestamp to uptime nanoseconds
   *
   * The frame processor gives us:
   * - tCrossPtsSeconds: The PTS time when crossing was detected
   * - ptsNowSeconds: Current PTS time at moment of detection
   * - uptimeNowNanos: Current uptime at moment of detection
   *
   * Formula:
   * tCrossUptimeNanos = uptimeNowNanos + (tCrossPtsSeconds - ptsNowSeconds) * 1e9
   *
   * Note: The delta is usually negative (crossing happened in the past)
   */
  @objc
  func convertPtsToUptime(
    _ tCrossPtsSeconds: Double,
    ptsNowSeconds: Double,
    uptimeNowNanos: String
  ) -> String {
    guard let uptimeNow = UInt64(uptimeNowNanos) else {
      return "0"
    }

    // Delta in seconds (usually negative, since crossing was in the past)
    let deltaSec = tCrossPtsSeconds - ptsNowSeconds
    let deltaNanos = Int64(deltaSec * 1_000_000_000.0)

    // Crossing uptime = current uptime + delta
    let tCrossUptime = Int64(uptimeNow) + deltaNanos

    return String(tCrossUptime)
  }

  // MARK: - Start Phone

  /**
   * Record local start crossing (called on start phone)
   * Converts PTS to uptime and returns for sending to finish phone
   */
  @objc
  func recordLocalStart(
    _ tCrossPtsSeconds: Double,
    ptsNowSeconds: Double,
    uptimeNowNanos: String
  ) -> String {
    let tCrossUptime = convertPtsToUptime(
      tCrossPtsSeconds,
      ptsNowSeconds: ptsNowSeconds,
      uptimeNowNanos: uptimeNowNanos
    )

    if let nanos = UInt64(tCrossUptime) {
      tStartLocalNanos = nanos
      hasStartTime = true
    }

    return tCrossUptime
  }

  // MARK: - Finish Phone

  /**
   * Record remote start time (called on finish phone when receiving from start phone)
   * Converts from start phone's domain to finish phone's domain using clock offset
   */
  @objc
  func recordRemoteStart(_ tStartRemoteNanos: String) {
    guard let remoteNanos = UInt64(tStartRemoteNanos) else {
      return
    }

    // Convert from start phone's time domain to our domain
    // localTime = remoteTime - offset
    // (offset is: local + offset = remote, so local = remote - offset)
    let localNanos = Int64(remoteNanos) - clockOffsetNanos

    tStartLocalNanos = UInt64(max(0, localNanos))
    hasStartTime = true
  }

  /**
   * Compute split time (called on finish phone)
   * Returns split time in nanoseconds and milliseconds
   */
  @objc
  func computeSplit(
    _ tCrossPtsSeconds: Double,
    ptsNowSeconds: Double,
    uptimeNowNanos: String
  ) -> [String: Any] {
    // Convert finish crossing PTS to uptime
    let tFinishStr = convertPtsToUptime(
      tCrossPtsSeconds,
      ptsNowSeconds: ptsNowSeconds,
      uptimeNowNanos: uptimeNowNanos
    )

    guard let tFinish = UInt64(tFinishStr) else {
      return [
        "splitNanos": "0",
        "splitMs": 0.0,
        "tFinishLocalNanos": "0",
        "tStartInFinishDomainNanos": "0"
      ]
    }

    tFinishLocalNanos = tFinish
    hasFinishTime = true

    // Calculate split
    let splitNanos: Int64
    if tFinish >= tStartLocalNanos {
      splitNanos = Int64(tFinish - tStartLocalNanos)
    } else {
      // Shouldn't happen, but handle gracefully
      splitNanos = 0
    }

    let splitMs = Double(splitNanos) / 1_000_000.0

    return [
      "splitNanos": String(splitNanos),
      "splitMs": splitMs,
      "tFinishLocalNanos": String(tFinish),
      "tStartInFinishDomainNanos": String(tStartLocalNanos)
    ]
  }

  // MARK: - Reset

  /**
   * Reset for new race (keep role and session)
   */
  @objc
  func reset() {
    tStartLocalNanos = 0
    tFinishLocalNanos = 0
    hasStartTime = false
    hasFinishTime = false
  }

  /**
   * Full reset (new session)
   */
  @objc
  func fullReset() {
    role = ""
    sessionId = ""
    clockOffsetNanos = 0
    reset()
  }

  /**
   * Get current status
   */
  @objc
  func getStatus() -> [String: Any] {
    return [
      "role": role,
      "sessionId": sessionId,
      "hasStartTime": hasStartTime,
      "hasFinishTime": hasFinishTime,
      "clockOffsetNanos": String(clockOffsetNanos)
    ]
  }

  // MARK: - React Native Bridge

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
