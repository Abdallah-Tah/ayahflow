# Adds ios/App/App/PrivacyInfo.xcprivacy (Apple's required privacy manifest) to the App target's resources, so it ships
# inside App.app (idempotent; preserves other manual changes).
#   ruby scripts/ios-add-privacy.rb
require 'xcodeproj'

project = Xcodeproj::Project.open(File.expand_path('../ios/App/App.xcodeproj', __dir__))
app = project.targets.find { |t| t.name == 'App' } or abort('App target not found')
group = project.main_group['App'] or abort('App group not found')
if app.resources_build_phase.files_references.any? { |f| f.path == 'PrivacyInfo.xcprivacy' }
  puts 'PrivacyInfo.xcprivacy already in the App target'
else
  ref = group.files.find { |f| f.path == 'PrivacyInfo.xcprivacy' } || group.new_file('PrivacyInfo.xcprivacy')
  app.add_resources([ref])
  project.save
  puts 'PrivacyInfo.xcprivacy added to the App target resources'
end
