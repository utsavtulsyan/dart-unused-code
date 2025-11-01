class User {
  String name;
  int age;

  User(this.name, this.age);

  // This method is used in main.dart
  String getInfo() {
    return '$name is $age years old';
  }

  // This method is UNUSED - should be detected
  String getFullDetails() {
    return 'Full details: $name, age: $age';
  }

  // This method is used internally
  bool isAdult() {
    return age >= 18;
  }

  // This uses isAdult internally
  String getStatus() {
    return isAdult() ? 'Adult' : 'Minor';
  }
}
