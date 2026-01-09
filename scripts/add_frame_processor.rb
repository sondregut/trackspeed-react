#!/usr/bin/env ruby
require 'xcodeproj'

project_path = ARGV[0] || 'ios/SprintTimerMVP.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main target
target = project.targets.find { |t| t.name == 'SprintTimerMVP' }

unless target
  puts "Could not find target 'SprintTimerMVP'"
  exit 1
end

# Find or create FrameProcessors group
main_group = project.main_group
app_group = main_group.groups.find { |g| g.name == 'SprintTimerMVP' }

unless app_group
  puts "Could not find 'SprintTimerMVP' group"
  exit 1
end

frame_processors_group = app_group.groups.find { |g| g.name == 'FrameProcessors' }

unless frame_processors_group
  frame_processors_group = app_group.new_group('FrameProcessors', 'FrameProcessors')
  puts "Created FrameProcessors group"
end

# Add the source file
file_path = 'FrameProcessors/SlitScanMVP.mm'
file_ref = frame_processors_group.files.find { |f| f.path == 'SlitScanMVP.mm' }

unless file_ref
  file_ref = frame_processors_group.new_file('SlitScanMVP.mm')
  puts "Added SlitScanMVP.mm to group"
end

# Add to target's compile sources
build_phase = target.source_build_phase
unless build_phase.files.any? { |f| f.file_ref == file_ref }
  build_phase.add_file_reference(file_ref)
  puts "Added SlitScanMVP.mm to compile sources"
end

project.save

puts "Successfully updated Xcode project"
