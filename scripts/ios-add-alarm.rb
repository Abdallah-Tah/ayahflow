# Adds ios/App/App/FajrAlarm.swift (AlarmKit Fajr alarm and its intents) to the App target (idempotent; preserves other
# manual changes). The intents must be compiled into the app itself, so the file cannot live in the plugin package.
#   ruby scripts/ios-add-alarm.rb
require 'xcodeproj'

project = Xcodeproj::Project.open(File.expand_path('../ios/App/App.xcodeproj', __dir__))
app = project.targets.find { |t| t.name == 'App' } or abort('App target not found')
group = project.main_group['App'] or abort('App group not found')
if app.source_build_phase.files_references.any? { |f| f.path == 'FajrAlarm.swift' }
  puts 'FajrAlarm.swift already in the App target'
else
  ref = group.files.find { |f| f.path == 'FajrAlarm.swift' } || group.new_file('FajrAlarm.swift')
  app.add_file_references([ref])
  project.save
  puts 'FajrAlarm.swift added to the App target'
end
