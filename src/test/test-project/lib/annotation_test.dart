// this is a test fixture for annotation testing

class AnnotationTestClass {
  @deprecated
  void annotatedDeprecatedMethod() {
    print('deprecated');
  }

  void regularNormalMethod() {
    print('normal');
  }
}
