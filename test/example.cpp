#include "cstdio"
#include <string>
#include <map>

class Example {
  public:
    Example():
        _var(42) {
    }
    Example(const Example& example) : _var(example._var) {

    }
    ~Example() {}
    Example &operator=(const Example& example) {
        this->_var = example._var;
    }

    Example &operator<<(std::ostream& (*manip)(std::ostream&)) {
        return *this;
    }

    template<class ...Args>
    void _dbg_printf(std::string fmt, Args&& ...args) {
    }
  private:
    int _var;
};

void multiArgs1(unsigned int a, unsigned int b);
void multiArgs2(unsigned int &a, unsigned int *b);
void multiArgs3(unsigned int&& a, unsigned int* *b);

void functionPtr1(unsigned int functionPtr(unsigned int test, unsigned int test2(unsigned int)), unsigned int value = 10);
void functionPtr4(unsigned int functionPtr(int), unsigned int value = 10){
    functionPtr((int)value);
}
void functionPtr5(unsigned int *functionPtr(int), unsigned int value = 10);
void functionPtr6(unsigned int *functionPtr(int[8]), unsigned int value = 10);
void functionPtr6(unsigned int functionPtr(int[8]), unsigned int value = 10);
void functionPtr3(unsigned int (*functionPtr)(int), unsigned int value = 10);
void functionPtr2(unsigned int (((*functionPtr)))(int, unsigned int (*test)(unsigned int)), unsigned int value = 10);
void functionPtr2(unsigned int (   (   (*functionPtr)  )   (  int  )  ), unsigned int value = 10);

void table(const unsigned int (((&arr)))[8]);
void table(const unsigned (((&arr)))[8]);

template<typename T>
void parenthesis(volatile T (func));

template<typename T>
void parenthesis2(T (a[]));
template<typename T>
void parenthesis2(T (T[]));

void functionParameter3(std::map<std::string, std::string> test, int value) {
}

void functionParameter4(std::map<std::string, std::string> test, int value[]) {
}


unsigned int doNothing3(int unused) {}
unsigned int doNothing2(unsigned int unused) {}

unsigned int doNothing(unsigned int unused, unsigned int (*unused2)(unsigned int)) {}

int main(int argc, char(* argv[])) {
    printf("Program name:   \"%s\"\n", argv[0]);
    printf("Number of args: %d\n", argc - 1);
    if (argc > 1) {
        printf("List of args:\n");
        for (int i = 1; i < argc; i++) {
            printf(" - \"%s\"\n", argv[i]);
        }
    }
    functionPtr4(doNothing3, 42);
}