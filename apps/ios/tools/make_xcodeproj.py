#!/usr/bin/env python3
"""Generates MozDiscounts.xcodeproj (classic explicit-file format). Run from apps/ios: python3 tools/make_xcodeproj.py
Set DEVELOPMENT_TEAM in Xcode (Signing & Capabilities) to run on a real iPhone."""
import hashlib, os, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = sorted(p.name for p in (root / "App/Sources").glob("*.swift"))
def uid(name): return hashlib.md5(name.encode()).hexdigest()[:24].upper()

PROJECT, TARGET, MAIN, SRCG, PRODG, PRODUCT = uid("project"), uid("target"), uid("maingroup"), uid("srcgroup"), uid("prodgroup"), uid("product")
PLIST, ASSETS, PKGREF, PKGDEP, PKGBUILD = uid("plist"), uid("assets"), uid("pkgref"), uid("pkgdep"), uid("pkgbuild")
SRCPHASE, FWPHASE, RESPHASE = uid("srcphase"), uid("fwphase"), uid("resphase")
PCFG, TCFG = uid("projcfglist"), uid("targcfglist")
PDEBUG, PREL, TDEBUG, TREL = uid("pdebug"), uid("prel"), uid("tdebug"), uid("trel")
PKGGROUP = uid("pkggroup")

o = []
w = o.append
w("// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {\n\t};\n\tobjectVersion = 56;\n\tobjects = {\n")
w("/* Begin PBXBuildFile section */")
for f in src: w(f"\t\t{uid('b'+f)} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {uid('f'+f)} /* {f} */; }};")
w(f"\t\t{uid('bassets')} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {ASSETS} /* Assets.xcassets */; }};")
w(f"\t\t{PKGBUILD} /* MozCore in Frameworks */ = {{isa = PBXBuildFile; productRef = {PKGDEP} /* MozCore */; }};")
w("/* End PBXBuildFile section */\n")
w("/* Begin PBXFileReference section */")
for f in src: w(f"\t\t{uid('f'+f)} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Sources/{f}; sourceTree = \"<group>\"; }};")
w(f"\t\t{PLIST} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = \"<group>\"; }};")
w(f"\t\t{ASSETS} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = \"<group>\"; }};")
w(f"\t\t{PRODUCT} /* MozDiscounts.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = MozDiscounts.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
w(f"\t\t{PKGGROUP} /* MozCore */ = {{isa = PBXFileReference; lastKnownFileType = wrapper; name = MozCore; path = MozCore; sourceTree = \"<group>\"; }};")
w("/* End PBXFileReference section */\n")
w("/* Begin PBXFrameworksBuildPhase section */")
w(f"\t\t{FWPHASE} /* Frameworks */ = {{\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t\t{PKGBUILD} /* MozCore in Frameworks */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};")
w("/* End PBXFrameworksBuildPhase section */\n")
w("/* Begin PBXGroup section */")
w(f"\t\t{MAIN} = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t{SRCG} /* App */,\n\t\t\t\t{PKGGROUP} /* MozCore */,\n\t\t\t\t{PRODG} /* Products */,\n\t\t\t);\n\t\t\tsourceTree = \"<group>\";\n\t\t}};")
kids = ",\n".join(f"\t\t\t\t{uid('f'+f)} /* {f} */" for f in src)
w(f"\t\t{SRCG} /* App */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n{kids},\n\t\t\t\t{PLIST} /* Info.plist */,\n\t\t\t\t{ASSETS} /* Assets.xcassets */,\n\t\t\t);\n\t\t\tpath = App;\n\t\t\tsourceTree = \"<group>\";\n\t\t}};")
w(f"\t\t{PRODG} /* Products */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t{PRODUCT} /* MozDiscounts.app */,\n\t\t\t);\n\t\t\tname = Products;\n\t\t\tsourceTree = \"<group>\";\n\t\t}};")
w("/* End PBXGroup section */\n")
w("/* Begin PBXNativeTarget section */")
w(f"\t\t{TARGET} /* MozDiscounts */ = {{\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = {TCFG};\n\t\t\tbuildPhases = (\n\t\t\t\t{SRCPHASE} /* Sources */,\n\t\t\t\t{FWPHASE} /* Frameworks */,\n\t\t\t\t{RESPHASE} /* Resources */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t);\n\t\t\tname = MozDiscounts;\n\t\t\tpackageProductDependencies = (\n\t\t\t\t{PKGDEP} /* MozCore */,\n\t\t\t);\n\t\t\tproductName = MozDiscounts;\n\t\t\tproductReference = {PRODUCT} /* MozDiscounts.app */;\n\t\t\tproductType = \"com.apple.product-type.application\";\n\t\t}};")
w("/* End PBXNativeTarget section */\n")
w("/* Begin PBXProject section */")
w(f"\t\t{PROJECT} /* Project object */ = {{\n\t\t\tisa = PBXProject;\n\t\t\tattributes = {{\n\t\t\t\tBuildIndependentTargetsInParallel = 1;\n\t\t\t\tLastSwiftUpdateCheck = 2700;\n\t\t\t\tLastUpgradeCheck = 2700;\n\t\t\t}};\n\t\t\tbuildConfigurationList = {PCFG};\n\t\t\tcompatibilityVersion = \"Xcode 14.0\";\n\t\t\tdevelopmentRegion = pt;\n\t\t\thasScannedForEncodings = 0;\n\t\t\tknownRegions = (\n\t\t\t\tpt,\n\t\t\t\ten,\n\t\t\t\tBase,\n\t\t\t);\n\t\t\tmainGroup = {MAIN};\n\t\t\tpackageReferences = (\n\t\t\t\t{PKGREF} /* XCLocalSwiftPackageReference \"MozCore\" */,\n\t\t\t);\n\t\t\tproductRefGroup = {PRODG} /* Products */;\n\t\t\tprojectDirPath = \"\";\n\t\t\tprojectRoot = \"\";\n\t\t\ttargets = (\n\t\t\t\t{TARGET} /* MozDiscounts */,\n\t\t\t);\n\t\t}};")
w("/* End PBXProject section */\n")
w("/* Begin PBXResourcesBuildPhase section */")
w(f"\t\t{RESPHASE} /* Resources */ = {{\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t\t{uid('bassets')} /* Assets.xcassets in Resources */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};")
w("/* End PBXResourcesBuildPhase section */\n")
w("/* Begin PBXSourcesBuildPhase section */")
files = ",\n".join(f"\t\t\t\t{uid('b'+f)} /* {f} in Sources */" for f in src)
w(f"\t\t{SRCPHASE} /* Sources */ = {{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n{files},\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};")
w("/* End PBXSourcesBuildPhase section */\n")

common_proj = ["ALWAYS_SEARCH_USER_PATHS = NO", "CLANG_ENABLE_MODULES = YES", "ENABLE_USER_SCRIPT_SANDBOXING = YES", "IPHONEOS_DEPLOYMENT_TARGET = 17.0", "SDKROOT = iphoneos", "SWIFT_VERSION = 5.0", "MTL_FAST_MATH = YES"]
def cfg(i, name, extra): 
    body = "\n".join(f"\t\t\t\t{s};" if not s.endswith("(") else s for s in extra)
    return f"\t\t{i} /* {name} */ = {{\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {{\n{body}\n\t\t\t}};\n\t\t\tname = {name};\n\t\t}};"
w("/* Begin XCBuildConfiguration section */")
w(cfg(PDEBUG, "Debug", common_proj + ["DEBUG_INFORMATION_FORMAT = dwarf", "ENABLE_TESTABILITY = YES", "GCC_OPTIMIZATION_LEVEL = 0", "ONLY_ACTIVE_ARCH = YES", "SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG", "SWIFT_OPTIMIZATION_LEVEL = \"-Onone\""]))
w(cfg(PREL, "Release", common_proj + ["DEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\"", "SWIFT_COMPILATION_MODE = wholemodule", "VALIDATE_PRODUCT = YES"]))
tcommon = ["ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon", "CODE_SIGN_STYLE = Automatic", "CURRENT_PROJECT_VERSION = 1", "DEVELOPMENT_TEAM = \"\"", "GENERATE_INFOPLIST_FILE = NO", "INFOPLIST_FILE = App/Info.plist",
           "LD_RUNPATH_SEARCH_PATHS = \"$(inherited) @executable_path/Frameworks\"", "MARKETING_VERSION = 1.0", "PRODUCT_BUNDLE_IDENTIFIER = mz.mozdiscounts.app", "PRODUCT_NAME = \"$(TARGET_NAME)\"",
           "SWIFT_EMIT_LOC_STRINGS = YES", "TARGETED_DEVICE_FAMILY = 1"]
w(cfg(TDEBUG, "Debug", tcommon + ["MOZ_API_BASE_URL = \"http:/$()/localhost:3000\""]))
w(cfg(TREL, "Release", tcommon + ["MOZ_API_BASE_URL = \"https:/$()/CHANGE-ME.vercel.app\""]))
w("/* End XCBuildConfiguration section */\n")
w("/* Begin XCConfigurationList section */")
w(f"\t\t{PCFG} /* Build configuration list for PBXProject \"MozDiscounts\" */ = {{\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t{PDEBUG} /* Debug */,\n\t\t\t\t{PREL} /* Release */,\n\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t}};")
w(f"\t\t{TCFG} /* Build configuration list for PBXNativeTarget \"MozDiscounts\" */ = {{\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t{TDEBUG} /* Debug */,\n\t\t\t\t{TREL} /* Release */,\n\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t}};")
w("/* End XCConfigurationList section */\n")
w("/* Begin XCLocalSwiftPackageReference section */")
w(f"\t\t{PKGREF} /* XCLocalSwiftPackageReference \"MozCore\" */ = {{\n\t\t\tisa = XCLocalSwiftPackageReference;\n\t\t\trelativePath = MozCore;\n\t\t}};")
w("/* End XCLocalSwiftPackageReference section */\n")
w("/* Begin XCSwiftPackageProductDependency section */")
w(f"\t\t{PKGDEP} /* MozCore */ = {{\n\t\t\tisa = XCSwiftPackageProductDependency;\n\t\t\tproductName = MozCore;\n\t\t}};")
w("/* End XCSwiftPackageProductDependency section */")
w(f"\t}};\n\trootObject = {PROJECT} /* Project object */;\n}}")
proj = root / "MozDiscounts.xcodeproj"; proj.mkdir(exist_ok=True)
(proj / "project.pbxproj").write_text("\n".join(o) + "\n")
print("wrote", proj / "project.pbxproj", f"({len(src)} sources)")
