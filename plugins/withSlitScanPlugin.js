const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to add the SlitScanMVP frame processor to the iOS project
 */
const withSlitScanPlugin = (config) => {
  // Add the .mm file to the Xcode project and set up header search paths
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;
    const projectRoot = config.modRequest.projectRoot;

    // Get the main group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;

    // Find or create FrameProcessors group
    let frameProcessorsGroupKey = null;
    const groups = xcodeProject.hash.project.objects['PBXGroup'];

    for (const key in groups) {
      if (groups[key].name === 'FrameProcessors' || groups[key].path === 'FrameProcessors') {
        frameProcessorsGroupKey = key;
        break;
      }
    }

    if (!frameProcessorsGroupKey) {
      // Create the group
      frameProcessorsGroupKey = xcodeProject.pbxCreateGroup('FrameProcessors', 'FrameProcessors');

      // Add to main group
      const mainGroupObj = groups[mainGroup];
      if (mainGroupObj && mainGroupObj.children) {
        mainGroupObj.children.push({
          value: frameProcessorsGroupKey,
          comment: 'FrameProcessors'
        });
      }
    }

    // Add the source file
    const sourceFile = 'SlitScanMVP.mm';
    xcodeProject.addSourceFile(
      `FrameProcessors/${sourceFile}`,
      { target: xcodeProject.getFirstTarget().uuid },
      frameProcessorsGroupKey
    );

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

  // Copy the source file to ios directory during prebuild
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName || 'SprintTimerMVP';

      const srcPath = path.join(
        projectRoot,
        'ios',
        'SprintTimerMVP',
        'FrameProcessors',
        'SlitScanMVP.mm'
      );

      const destDir = path.join(
        projectRoot,
        'ios',
        projectName,
        'FrameProcessors'
      );

      const destPath = path.join(destDir, 'SlitScanMVP.mm');

      // Create destination directory if it doesn't exist
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Copy the file if source exists
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied SlitScanMVP.mm to ${destPath}`);
      }

      return config;
    }
  ]);

  return config;
};

module.exports = withSlitScanPlugin;
