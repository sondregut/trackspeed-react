const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to add the SlitScanMVP frame processor and Race modules to the iOS project
 */
const withSlitScanPlugin = (config) => {
  // Add the source files to the Xcode project and set up header search paths
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;
    const projectRoot = config.modRequest.projectRoot;

    // Get the main group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
    const groups = xcodeProject.hash.project.objects['PBXGroup'];

    // Helper to find or create a group
    const findOrCreateGroup = (groupName, groupPath) => {
      let groupKey = null;
      for (const key in groups) {
        if (groups[key].name === groupName || groups[key].path === groupPath) {
          groupKey = key;
          break;
        }
      }

      if (!groupKey) {
        groupKey = xcodeProject.pbxCreateGroup(groupName, groupPath);
        const mainGroupObj = groups[mainGroup];
        if (mainGroupObj && mainGroupObj.children) {
          mainGroupObj.children.push({
            value: groupKey,
            comment: groupName
          });
        }
      }
      return groupKey;
    };

    // Add FrameProcessors group and file
    // Group path is relative to ios/, file path is just filename since group handles directory
    const frameProcessorsGroupKey = findOrCreateGroup('FrameProcessors', `${projectName}/FrameProcessors`);
    xcodeProject.addSourceFile(
      'SlitScanMVP.mm',
      { target: xcodeProject.getFirstTarget().uuid },
      frameProcessorsGroupKey
    );

    // Add Race group and files
    const raceGroupKey = findOrCreateGroup('Race', `${projectName}/Race`);

    // Add Race module source files - just filenames, group path handles directory
    const raceFiles = [
      'RaceSyncModule.swift',
      'RaceSyncModule.m',
      'RaceSessionModule.swift',
      'RaceSessionModule.m',
    ];

    for (const file of raceFiles) {
      xcodeProject.addSourceFile(
        file,
        { target: xcodeProject.getFirstTarget().uuid },
        raceGroupKey
      );
    }

    // Add header search paths for VisionCamera private headers
    const headerSearchPaths = [
      '"$(inherited)"',
      '"$(SRCROOT)/../node_modules/react-native-vision-camera/ios/FrameProcessors"',
      '"$(SRCROOT)/../node_modules/react-native-worklets-core/ios"',
    ];

    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const config = configurations[key];
      if (config.buildSettings) {
        // Only modify app target configurations (not Pods)
        if (config.name === 'Debug' || config.name === 'Release') {
          const currentPaths = config.buildSettings.HEADER_SEARCH_PATHS || [];

          // If it's a string, convert to array
          let pathsArray = [];
          if (typeof currentPaths === 'string') {
            pathsArray = [currentPaths];
          } else if (Array.isArray(currentPaths)) {
            pathsArray = [...currentPaths];
          }

          // Add our paths if not already present
          for (const searchPath of headerSearchPaths) {
            if (!pathsArray.includes(searchPath)) {
              pathsArray.push(searchPath);
            }
          }

          config.buildSettings.HEADER_SEARCH_PATHS = pathsArray;
        }
      }
    }

    return config;
  });

  // Copy the source files to ios directory during prebuild
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName || 'SprintTimerMVP';

      // Copy FrameProcessors files from native/ directory (persistent, not in ios/)
      const frameProcessorsSrcDir = path.join(projectRoot, 'native', 'FrameProcessors');
      const frameProcessorsDestDir = path.join(projectRoot, 'ios', projectName, 'FrameProcessors');

      if (!fs.existsSync(frameProcessorsDestDir)) {
        fs.mkdirSync(frameProcessorsDestDir, { recursive: true });
      }

      const frameProcessorFiles = ['SlitScanMVP.mm'];
      for (const file of frameProcessorFiles) {
        const srcPath = path.join(frameProcessorsSrcDir, file);
        const destPath = path.join(frameProcessorsDestDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`Copied ${file} to ${destPath}`);
        } else {
          console.warn(`Warning: Source file not found: ${srcPath}`);
        }
      }

      // Copy Race module files from native/ directory (persistent, not in ios/)
      const raceSrcDir = path.join(projectRoot, 'native', 'Race');
      const raceDestDir = path.join(projectRoot, 'ios', projectName, 'Race');

      if (!fs.existsSync(raceDestDir)) {
        fs.mkdirSync(raceDestDir, { recursive: true });
      }

      const raceFiles = [
        'RaceSyncModule.swift',
        'RaceSyncModule.m',
        'RaceSessionModule.swift',
        'RaceSessionModule.m',
      ];

      for (const file of raceFiles) {
        const srcPath = path.join(raceSrcDir, file);
        const destPath = path.join(raceDestDir, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`Copied ${file} to ${destPath}`);
        } else {
          console.warn(`Warning: Source file not found: ${srcPath}`);
        }
      }

      return config;
    }
  ]);

  return config;
};

module.exports = withSlitScanPlugin;
