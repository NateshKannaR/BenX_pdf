local system = assert(io.open("/proc/sys/kernel/ostype"))
print("Hello from " .. system:read("*l") .. " via " .. _VERSION)
system:close()
