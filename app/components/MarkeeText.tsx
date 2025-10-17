import React, { useRef, useEffect } from "react";
import { Animated, Text, View, StyleSheet, Dimensions } from "react-native";

const screenWidth = Dimensions.get("window").width;

const MarqueeText = ({ text }: { text: string }) => {
  const translateX = useRef(new Animated.Value(screenWidth)).current;

  useEffect(() => {
    const animate = () => {
      translateX.setValue(screenWidth);
      Animated.timing(translateX, {
        toValue: -screenWidth,
        duration: 8000,
        useNativeDriver: true,
      }).start(() => animate());
    };

    animate();
  }, [translateX]);

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.text,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {text}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    height: 30,
    justifyContent: "center",
    backgroundColor: "#3b82f6",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    paddingHorizontal: 20,
  },
});

export default MarqueeText;
