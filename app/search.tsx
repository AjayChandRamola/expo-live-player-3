// app/search.tsx
import React, { useCallback } from "react";
import { FlatList } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Screen } from "../components/ui/Screen";
import { StateView } from "../components/ui/StateView";
import { SearchInput } from "../components/Search/SearchInput";
import { RecentSearches } from "../components/Search/RecentSearches";
import VideoCard from "../components/VideoFeed/VideoCard";
import { toVideoMetadata } from "../services/videoMetadataAdapter";
import { usePlayQueue } from "../contexts/PlayQueueContext";
import { useSearch } from "../hooks/useSearch";
import type { Video } from "../types/domain";

export default function SearchScreen() {
  const router = useRouter();
  const { setQueue } = usePlayQueue();
  const { status, data, error, retry, query, setQuery, commit, recent, clearRecent } =
    useSearch();

  const handlePressResult = useCallback(
    (video: Video) => {
      setQueue(data ?? [], video.id);
      router.push(`/video/${video.id}`);
    },
    [router, setQueue, data],
  );

  const handleSelectRecent = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery);
    },
    [setQuery],
  );

  return (
    <>
      <Stack.Screen options={{ title: "Search" }} />
      <Screen testID="search-screen">
        <SearchInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          onSubmit={commit}
        />

        {status === "idle" ? (
          <RecentSearches
            queries={recent}
            onSelect={handleSelectRecent}
            onClear={clearRecent}
            testID="search-recent"
          />
        ) : (
          <>
            <StateView status={status} error={error} onRetry={retry} testID="search-state" />
            {status === "success" && data ? (
              <FlatList
                data={data}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <VideoCard
                    testID={`search-result-${item.id}`}
                    video={toVideoMetadata(item)}
                    onPress={() => handlePressResult(item)}
                  />
                )}
              />
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}
