import 'user.dart';
import 'example.dart';

void main() {
  // Using Calculator.add from example.dart
  final calc = Calculator();
  print('Sum: ${calc.add(5, 3)}');

  // Using User.getInfo from user.dart
  final user = User('John', 25);
  print(user.getInfo());
  print(user.getStatus());
}
