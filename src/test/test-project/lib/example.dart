// ignore_for_file: unused_element

class Calculator {
  // This method is used
  int add(int a, int b) {
    return a + b;
  }

  // This method is UNUSED - should be detected
  int multiply(int a, int b) {
    return a * b;
  }

  // Private method - should be skipped
  int _subtract(int a, int b) {
    return a - b;
  }
}

void main() {
  final calc = Calculator();
  print(calc.add(2, 3));
}
