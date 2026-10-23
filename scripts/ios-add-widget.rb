# Adds the AyahFlow WidgetKit extension to ios/App/App.xcodeproj (idempotent; preserves other manual changes).
#   ruby scripts/ios-add-widget.rb
# Uses the xcodeproj gem (ships with CocoaPods). The extension shares data with the app through a keychain access
# group, because App Groups are unavailable to personal development teams.
require 'xcodeproj'

project = Xcodeproj::Project.open(File.expand_path('../ios/App/App.xcodeproj', __dir__))
app = project.targets.find { |t| t.name == 'App' } or abort('App target not found')
name = 'AyahFlowWidget'
app_settings = app.build_configurations.first.build_settings

# The app needs the same keychain group and the Info.plist key that names it.
app.build_configurations.each { |c| c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements' }
app_group = project.main_group['App']
app_group.new_file('App.entitlements') unless app_group.files.any? { |f| f.path == 'App.entitlements' }

if project.targets.any? { |t| t.name == name }
  puts "#{name} target already present"
else
  group = project.main_group.new_group(name, name)
  swift = group.new_file('AyahFlowWidget.swift')
  group.new_file('Info.plist')
  group.new_file('AyahFlowWidget.entitlements')
  widget = project.new_target(:app_extension, name, :ios, '15.0')
  widget.add_file_references([swift])
  widget.add_system_frameworks(%w[WidgetKit SwiftUI])
  widget.build_configurations.each do |c|
    s = c.build_settings
    s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.buildwithabdallah.ayahflow.widget'
    s['PRODUCT_NAME'] = '$(TARGET_NAME)'
    s['INFOPLIST_FILE'] = "#{name}/Info.plist"
    s['CODE_SIGN_ENTITLEMENTS'] = "#{name}/AyahFlowWidget.entitlements"
    s['CODE_SIGN_STYLE'] = 'Automatic'
    s['GENERATE_INFOPLIST_FILE'] = 'NO'
    s['SWIFT_VERSION'] = '5.0'
    s['TARGETED_DEVICE_FAMILY'] = '1,2'
    s['SKIP_INSTALL'] = 'YES'
    s['MARKETING_VERSION'] = app_settings['MARKETING_VERSION'] || '1.0'
    s['CURRENT_PROJECT_VERSION'] = app_settings['CURRENT_PROJECT_VERSION'] || '1'
    s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  end
  app.add_dependency(widget)
  embed = app.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' } || app.new_copy_files_build_phase('Embed Foundation Extensions')
  embed.symbol_dst_subfolder_spec = :plug_ins
  embed.add_file_reference(widget.product_reference, true).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  puts "Added #{name} target"
end
project.save
